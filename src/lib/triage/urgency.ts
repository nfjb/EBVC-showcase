/**
 * Urgency, cockpit priority, open tasks and the next action for a company.
 *
 * priority = Fathom score % × urgency. Urgency comes only from obligations and news (an open warm
 * intro's reply-deadline stage, how recent the latest signal is) and never from days in
 * queue: waiting longer only raises the 14/21-day flag (user decision 2026-09-30).
 */

import { demoToday, loadTriageConfig } from "./config";
import { daysBetween, shortWeekday, type IsoDate } from "./dates";
import { compareCodePoints, pyGet, pyRound } from "./py";
import { DECISION_REQUIRED, FATHOM_KEYS, queueFlag } from "./scoring";
import { ESCALATED, introReplyState, REMINDER_TO_OWNER, type IntroReplyState } from "./workingDays";

type IntroFields = { channel: string; intro_status: string; received_at: IsoDate; introducer_type: string };

/** The company fields the cockpit reads; the full Company row satisfies it. */
export interface LineCompany<T extends IntroFields = IntroFields> {
  id: number;
  name: string;
  score: number;
  first_seen_at: IsoDate | null;
  latest_signal_at: IsoDate | null;
  rank_override: number | null;
  status: string;
  passed_hard_filters: boolean;
  touchpoints: T[];
}

/** The cockpit's whole-number score % (the stored Fathom score is already a percentage). */
export function scorePercent(score: number): number {
  return pyRound(score);
}

/** The open task while any Fathom dimension is still unrated. */
export const RATE_TASK = "Rate the Fathom criteria";

/** The company's open warm intro (the most recent one), or null. */
export function openIntro<T extends IntroFields>(company: { touchpoints: T[] }): T | null {
  let latest: T | null = null;
  for (const touchpoint of company.touchpoints) {
    if (touchpoint.channel !== "warm_intro" || touchpoint.intro_status !== "open") continue;
    if (latest === null || touchpoint.received_at > latest.received_at) latest = touchpoint;
  }
  return latest;
}

export function introState(intro: { received_at: IsoDate } | null, today: IsoDate): IntroReplyState | null {
  if (intro === null) return null;
  return introReplyState(intro.received_at, today, loadTriageConfig().intro_reply_working_days);
}

/** 0–100 from the intro deadline stage and signal recency. No queue-age input. */
export function urgency(latestSignalAt: IsoDate | null, state: IntroReplyState | null, today: IsoDate): number {
  const rules = loadTriageConfig().urgency;
  if (state !== null) {
    if (state.past_deadline) return rules.intro_overdue;
    if (state.escalation === ESCALATED) return rules.intro_due_today;
    if (state.escalation === REMINDER_TO_OWNER) return rules.intro_reminder;
    return rules.intro_open;
  }
  let value = rules.base;
  if (latestSignalAt !== null) {
    const age = daysBetween(latestSignalAt, today);
    if (age <= rules.recent_signal_days) value += rules.recent_signal_bonus;
    else if (age <= rules.signal_days) value += rules.signal_bonus;
  }
  return Math.min(value, 100);
}

export type NextActionKind = "deal" | "intro" | "pass_draft" | "merge";

/** Everything the cockpit shows for one company. */
export interface CockpitLine<C extends LineCompany = LineCompany> {
  company: C;
  score_percent: number;
  urgency: number;
  priority: number;
  days_in_queue: number;
  flag: string;
  intro: C["touchpoints"][number] | null;
  intro_state: IntroReplyState | null;
  tasks: string[];
  next_action: string;
  next_action_kind: NextActionKind;
  urgent: boolean;
}

/** True while a person has not yet rated every Fathom dimension (the storytelling bonus is optional). */
export function needsRating(company: object): boolean {
  const ratings = company as Record<string, unknown>;
  return FATHOM_KEYS.some((key) => ratings[key] === null || ratings[key] === undefined);
}

const INTRODUCER_SHORT_LABELS: Record<string, string> = { LP: "LP", portfolio_founder: "Portfolio", angel: "Angel" };

export function buildLine<C extends LineCompany>(
  company: C,
  today: IsoDate | null = null,
  pendingMergeIds: ReadonlySet<number> = new Set(),
  passReplySentIds: ReadonlySet<number> = new Set(),
): CockpitLine<C> {
  const day = today ?? demoToday();
  const config = loadTriageConfig();
  const intro = openIntro(company);
  const state = introState(intro, day);
  const waiting = company.first_seen_at ? daysBetween(company.first_seen_at, day) : 0;
  const flag = queueFlag(waiting, config.queue_flags);
  const percent = scorePercent(company.score);
  const urgencyValue = urgency(company.latest_signal_at, state, day);
  const line: CockpitLine<C> = {
    company,
    score_percent: percent,
    urgency: urgencyValue,
    priority: pyRound((percent * urgencyValue) / 100, 1),
    days_in_queue: waiting,
    flag,
    intro,
    intro_state: state,
    tasks: [],
    next_action: "",
    next_action_kind: "deal",
    urgent: false,
  };

  if (state !== null && intro !== null) {
    const label = pyGet(INTRODUCER_SHORT_LABELS, intro.introducer_type, "Warm");
    line.tasks.push("Reply to warm intro");
    line.next_action = state.past_deadline
      ? `${label} intro reply · overdue`
      : `${label} intro reply · ${shortWeekday(state.deadline)}`;
    line.next_action_kind = "intro";
    line.urgent = true;
  }
  if (pendingMergeIds.has(company.id)) line.tasks.push("Confirm possible duplicate");
  if (company.status === "open" && !company.passed_hard_filters) {
    if (!passReplySentIds.has(company.id)) line.tasks.push("Approve pass draft");
  } else if (company.status === "open" && needsRating(company)) {
    line.tasks.push(RATE_TASK);
  }
  if (company.status === "open" && company.passed_hard_filters && flag) line.tasks.push(flag);

  if (!line.next_action) {
    if (line.tasks.includes("Approve pass draft")) {
      line.next_action = "Approve pass draft";
      line.next_action_kind = "pass_draft";
    } else if (line.tasks.includes("Confirm possible duplicate")) {
      line.next_action = "Confirm duplicate";
      line.next_action_kind = "merge";
    } else if (flag === DECISION_REQUIRED) {
      line.next_action = "Decide at next meeting";
      line.urgent = true;
    } else if (flag) {
      line.next_action = "Decide this week";
    } else if (line.tasks.includes(RATE_TASK)) {
      line.next_action = "Rate the deal";
    } else if (company.status === "open") {
      line.next_action = "Decide: advance or pass";
    } else {
      line.next_action = "Open deal";
    }
  }
  return line;
}

/**
 * Highest score % × urgency first, then score, then urgency (so deals nobody has rated yet,
 * all at 0 %, still come in order of what is most pressing); ranks pinned by a person keep
 * their position.
 */
export function rankByPriority<L extends CockpitLine>(lines: L[]): L[] {
  const pinned = lines
    .filter((line) => line.company.rank_override)
    .sort((a, b) => a.company.rank_override! - b.company.rank_override!);
  const ranked = lines
    .filter((line) => !line.company.rank_override)
    .sort(
      (a, b) =>
        b.priority - a.priority ||
        b.score_percent - a.score_percent ||
        b.urgency - a.urgency ||
        compareCodePoints(a.company.name, b.company.name),
    );
  for (const line of pinned) {
    ranked.splice(Math.min(line.company.rank_override!, ranked.length + 1) - 1, 0, line);
  }
  return ranked;
}

export const QUADRANTS = {
  act_now: ["Act now", "High score, urgent: reply and decide this week."],
  plan: ["Plan a deep dive", "High score, no deadline: schedule a proper look."],
  reply_fast: ["Reply fast", "Urgent obligation, weaker fit: answer quickly, then decide."],
  park: ["Park or pass", "Weaker fit, nothing pressing: pass with a reason or revisit later."],
} as const;
export type QuadrantKey = keyof typeof QUADRANTS;

/** Which of the four matrix quadrants a deal falls in (config/weights.yaml → matrix). */
export function quadrant(scorePercentValue: number, urgencyValue: number): QuadrantKey {
  const splits = loadTriageConfig().matrix;
  const highScore = scorePercentValue >= splits.score_split;
  const urgent = urgencyValue >= splits.urgency_split;
  if (highScore && urgent) return "act_now";
  if (highScore) return "plan";
  if (urgent) return "reply_fast";
  return "park";
}
