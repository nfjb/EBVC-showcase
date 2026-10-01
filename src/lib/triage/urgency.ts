/**
 * Urgency, cockpit priority, open tasks and the next action for a company.
 *
 * priority = Quality Score × Urgency Score / 100. The Urgency Score comes from five
 * dimensions (reply obligation, relationship, activity signal, competitive pressure, founder
 * momentum) and never from days in queue: waiting longer only raises the 14/21-day flag
 * (user decision 2026-09-30).
 */

import { demoToday, loadTriageConfig } from "./config";
import { daysBetween, longDate, shortWeekday, type IsoDate } from "./dates";
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
  latest_signal_type?: string;
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

/** The company fields the Urgency Score reads. Never first_seen_at: time in queue is no input. */
export interface UrgencyCompany {
  latest_signal_at: IsoDate | null;
  latest_signal_type?: string;
  touchpoints: { channel: string; received_at: IsoDate; introducer_type: string }[];
}

/** One dimension of the Urgency Score: the points it adds, out of its maximum, and why. */
export interface UrgencyRow {
  dimension: "reply_obligation" | "relationship" | "activity" | "competitive_pressure" | "momentum";
  label: string;
  points: number;
  max: number;
  note: string;
}

export interface UrgencyBreakdown {
  rows: UrgencyRow[];
  raw: number;
  max_raw: number;
  /** round(raw / max_raw × 100). */
  score: number;
  tier: { label: string; action: string };
}

export const URGENCY_DIMENSIONS: Record<UrgencyRow["dimension"], string> = {
  reply_obligation: "Reply obligation",
  relationship: "Relationship proximity",
  activity: "Activity signal",
  competitive_pressure: "Competitive pressure",
  momentum: "Founder momentum",
};

const SIGNAL_LABELS: Record<string, string> = {
  round_announced: "a round announced by another lead",
  traction_update: "a traction update",
  senior_hire: "a senior hire",
  news: "news",
};

const INTRODUCER_ARTICLES: Record<string, string> = {
  LP: "an LP",
  portfolio_founder: "a portfolio founder",
  angel: "an angel",
};

function daysAgo(day: IsoDate, today: IsoDate): string {
  const age = daysBetween(day, today);
  return `${longDate(day)}, ${age} day${age === 1 ? "" : "s"} ago`;
}

/** Points from the first band (most recent first) whose ``days`` the age is within. */
function banded(age: number, bands: { days: number; points: number }[]): number {
  return bands.find((band) => age <= band.days)?.points ?? 0;
}

/** The highest raw score possible: the sum of every dimension's maximum (120 by default). */
export function maxUrgencyRaw(): number {
  const rules = loadTriageConfig().urgency;
  return (
    Math.max(...Object.values(rules.reply_obligation)) +
    Math.max(...Object.values(rules.relationship)) +
    Math.max(0, ...rules.activity.map((band) => band.points)) +
    Math.max(0, ...Object.values(rules.competitive_pressure)) +
    Math.max(0, ...rules.momentum.map((band) => band.points))
  );
}

/**
 * The Urgency Score, dimension by dimension (config/weights.yaml → urgency), like the LP
 * scoring matrix: a raw sum out of {@link maxUrgencyRaw}, normalised to 0–100. Reads only
 * obligations, relationships and news; never days in queue.
 */
export function urgencyBreakdown(
  company: UrgencyCompany,
  state: IntroReplyState | null,
  today: IsoDate,
  introLabel = "Warm",
): UrgencyBreakdown {
  const rules = loadTriageConfig().urgency;
  const rows: UrgencyRow[] = [];
  const add = (dimension: UrgencyRow["dimension"], points: number, max: number, note: string) =>
    rows.push({ dimension, label: URGENCY_DIMENSIONS[dimension], points, max, note });

  // 1. Reply obligation: an open warm intro, by its deadline stage.
  const obligation = rules.reply_obligation;
  const obligationMax = Math.max(...Object.values(obligation));
  if (state === null) add("reply_obligation", obligation.none, obligationMax, "No open warm intro");
  else if (state.past_deadline) {
    add("reply_obligation", obligation.overdue, obligationMax, `${introLabel} intro reply overdue since ${longDate(state.deadline)}`);
  } else if (state.escalation === ESCALATED) {
    add("reply_obligation", obligation.due_today, obligationMax, `${introLabel} intro reply due today, escalated to the partner`);
  } else if (state.escalation === REMINDER_TO_OWNER) {
    add("reply_obligation", obligation.reminder, obligationMax, `${introLabel} intro reply due ${longDate(state.deadline)}, owner reminded`);
  } else {
    add("reply_obligation", obligation.open, obligationMax, `${introLabel} intro awaiting a reply, due ${longDate(state.deadline)}`);
  }

  // 2. Relationship proximity: warm intro > contact on several channels > a single cold inbound.
  const relationship = rules.relationship;
  const relationshipMax = Math.max(...Object.values(relationship));
  const warm = company.touchpoints.find((touchpoint) => touchpoint.channel === "warm_intro");
  const channels = new Set(company.touchpoints.map((touchpoint) => touchpoint.channel));
  if (warm) {
    add("relationship", relationship.warm_intro, relationshipMax, `Warm intro from ${pyGet(INTRODUCER_ARTICLES, warm.introducer_type, "an introducer")}`);
  } else if (channels.size >= 2) {
    add("relationship", relationship.repeat_contact, relationshipMax, `Reached out on ${channels.size} channels`);
  } else {
    add("relationship", relationship.cold, relationshipMax, "A single cold inbound");
  }

  // 3. Activity signal: how recent the latest signal is.
  const activityMax = Math.max(0, ...rules.activity.map((band) => band.points));
  const signalAge = company.latest_signal_at === null ? null : daysBetween(company.latest_signal_at, today);
  if (signalAge === null || company.latest_signal_at === null) add("activity", 0, activityMax, "No signal");
  else {
    const points = banded(signalAge, rules.activity);
    add("activity", points, activityMax, `Latest signal on ${daysAgo(company.latest_signal_at, today)}`);
  }

  // 4. Competitive pressure: what the latest signal says, while it is recent.
  const pressureMax = Math.max(0, ...Object.values(rules.competitive_pressure));
  const type = company.latest_signal_type ?? "";
  if (!type || signalAge === null) add("competitive_pressure", 0, pressureMax, "No signal");
  else if (signalAge > rules.competitive_pressure_days) {
    add("competitive_pressure", 0, pressureMax, `Latest signal older than ${rules.competitive_pressure_days} days`);
  } else {
    add("competitive_pressure", pyGet(rules.competitive_pressure, type, 0), pressureMax, `Latest signal is ${pyGet(SIGNAL_LABELS, type, type)}`);
  }

  // 5. Founder momentum: how recently the founder last got in touch (not when they first did).
  const momentumMax = Math.max(0, ...rules.momentum.map((band) => band.points));
  const latestTouch = company.touchpoints.reduce<IsoDate | null>(
    (latest, touchpoint) => (latest === null || touchpoint.received_at > latest ? touchpoint.received_at : latest),
    null,
  );
  if (latestTouch === null) add("momentum", 0, momentumMax, "No inbound");
  else add("momentum", banded(daysBetween(latestTouch, today), rules.momentum), momentumMax, `Latest inbound on ${daysAgo(latestTouch, today)}`);

  const raw = rows.reduce((sum, row) => sum + row.points, 0);
  const maxRaw = maxUrgencyRaw();
  const score = Math.min(100, pyRound((100 * raw) / maxRaw));
  const tier = rules.tiers.find((candidate) => score >= candidate.min) ?? rules.tiers[rules.tiers.length - 1];
  return { rows, raw, max_raw: maxRaw, score, tier: { label: tier.label, action: tier.action } };
}

/** The Urgency Score (0–100). No queue-age input. */
export function urgency(company: UrgencyCompany, state: IntroReplyState | null, today: IsoDate): number {
  return urgencyBreakdown(company, state, today).score;
}

/** The score, its raw sum and its tier in one line, e.g. "63/100 (raw 75/120) · This week". */
export function urgencySummary(breakdown: UrgencyBreakdown): string {
  return `${breakdown.score}/100 (raw ${breakdown.raw}/${breakdown.max_raw}) · ${breakdown.tier.label}`;
}

/** The general rule, for the tooltip on the Urgency Score column header. */
export function urgencyRule(): string {
  const maxRaw = maxUrgencyRaw();
  return (
    "Five dimensions: reply obligation (an open warm intro's deadline), relationship proximity, activity signal " +
    `(how recent the latest signal is), competitive pressure (what it says) and founder momentum. Raw sum out of ${maxRaw}, ` +
    `normalised to 0–100. Time in the queue never counts.`
  );
}

export type NextActionKind = "deal" | "intro" | "pass_draft" | "merge";

/** Everything the cockpit shows for one company. */
export interface CockpitLine<C extends LineCompany = LineCompany> {
  company: C;
  score_percent: number;
  urgency: number;
  /** Why the urgency is what it is, dimension by dimension (tooltip, explanations). */
  urgency_breakdown: UrgencyBreakdown;
  /** The same in one line: "63/100 (raw 75/120) · This week". */
  urgency_reason: string;
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
  const breakdown = urgencyBreakdown(
    company,
    state,
    day,
    intro ? pyGet(INTRODUCER_SHORT_LABELS, intro.introducer_type, "Warm") : "Warm",
  );
  const urgencyValue = breakdown.score;
  const line: CockpitLine<C> = {
    company,
    score_percent: percent,
    urgency: urgencyValue,
    urgency_breakdown: breakdown,
    urgency_reason: urgencySummary(breakdown),
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
