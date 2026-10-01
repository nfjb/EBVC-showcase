/**
 * The Monday briefing: the facts for each deal on the top-20 worklist, worked out here from
 * the CRM so they are always right. An AI model may phrase them as a short note
 * (``briefingPrompt.ts``), but it is never the source of a fact, a rating or a decision.
 *
 * Only company-level facts are collected: no founder names, email addresses or LinkedIn
 * profiles, and introducers by type only. That is all that leaves the browser.
 */

import type { Line } from "./cockpit";
import { tileFilters } from "./cockpit";
import { loadTriageConfig } from "./config";
import { daysBetween, longDate, type IsoDate } from "./dates";
import { CHANNEL_LABELS, INTRODUCER_LABELS, label } from "./labels";
import { pyFixed } from "./py";
import { O1_DIMENSIONS, ratedCount, ratingsOf, scoreBand } from "./scoring";

/** An O1 dimension that needs attention: unrated, or rated 2 or lower. */
export interface O1Gap {
  dimension: string;
  weight: number;
  rating: number | null;
}

/** Everything the briefing knows about one deal. */
export interface BriefingDeal {
  id: number;
  rank: number;
  company: string;
  one_liner: string;
  stage: string;
  country: string;
  round_size_eur: number | null;
  owner: string;
  o1_score: number;
  o1_assessment: string;
  o1_rated: number;
  o1_gaps: O1Gap[];
  /** Facts from the last couple of weeks: signals, new inbound, a new warm intro. */
  whats_new: string[];
  open_tasks: string[];
  next_action: string;
  days_in_queue: number;
  queue_flag: string;
  touchpoints: number;
  channels: string[];
  intro: { introducer_type: string; deadline: IsoDate; overdue: boolean } | null;
}

const LOW_RATING = 2;

/** Unrated or weak O1 dimensions, the heaviest first (framework order breaks ties). */
export function o1Gaps(company: object): O1Gap[] {
  const { weights } = loadTriageConfig().o1;
  const ratings = ratingsOf(company);
  return O1_DIMENSIONS.filter((dimension) => {
    const rating = ratings[dimension.key];
    return rating === null || rating <= LOW_RATING;
  })
    .map((dimension) => ({ dimension: dimension.label, weight: weights[dimension.key], rating: ratings[dimension.key] }))
    .sort((a, b) => b.weight - a.weight);
}

/** What changed recently, as plain facts. */
export function whatsNew(line: Line, today: IsoDate): string[] {
  const config = loadTriageConfig();
  const company = line.company;
  const facts: string[] = [];
  if (company.latest_signal && company.latest_signal_at) {
    if (daysBetween(company.latest_signal_at, today) <= config.urgency.signal_days) {
      facts.push(`Signal on ${longDate(company.latest_signal_at)}: ${company.latest_signal}`);
    }
  }
  const recent = company.touchpoints.filter(
    (touchpoint) => daysBetween(touchpoint.received_at, today) <= config.cockpit.new_startup_days,
  );
  for (const touchpoint of recent) {
    const via =
      touchpoint.channel === "warm_intro"
        ? `warm intro from ${label(INTRODUCER_LABELS, touchpoint.introducer_type).toLowerCase()}`
        : label(CHANNEL_LABELS, touchpoint.channel).toLowerCase();
    facts.push(`New inbound on ${longDate(touchpoint.received_at)} (${via}) to ${touchpoint.recipient}`);
  }
  return facts;
}

/** The deals the briefing covers: the top-20 worklist, in its order. */
export function briefingDeals(lines: Line[], today: IsoDate): BriefingDeal[] {
  const { o1 } = loadTriageConfig();
  return tileFilters(lines).top.map((line, index) => {
    const company = line.company;
    const rated = ratedCount(company);
    return {
      id: company.id,
      rank: index + 1,
      company: company.name,
      one_liner: company.one_liner,
      stage: company.stage,
      country: company.country,
      round_size_eur: company.round_size_eur,
      owner: company.owner,
      o1_score: company.score,
      o1_assessment: scoreBand(company.score, rated, o1),
      o1_rated: rated,
      o1_gaps: o1Gaps(company),
      whats_new: whatsNew(line, today),
      open_tasks: line.tasks,
      next_action: line.next_action,
      days_in_queue: line.days_in_queue,
      queue_flag: line.flag,
      touchpoints: company.touchpoint_count,
      channels: [...new Set(company.touchpoints.map((touchpoint) => label(CHANNEL_LABELS, touchpoint.channel)))],
      intro:
        line.intro && line.intro_state
          ? {
              introducer_type: label(INTRODUCER_LABELS, line.intro.introducer_type),
              deadline: line.intro_state.deadline,
              overdue: line.intro_state.past_deadline,
            }
          : null,
    };
  });
}

/** One plain line about the O1 gaps, for the page when there is no AI note. */
export function gapsSummary(deal: BriefingDeal): string {
  if (!deal.o1_rated) return "Not rated on O1 yet.";
  if (!deal.o1_gaps.length) return "No unrated or weak O1 dimension.";
  return deal.o1_gaps
    .map((gap) => `${gap.dimension} (${gap.rating === null ? "unrated" : `rated ${gap.rating}`}, ${gap.weight} %)`)
    .join(", ");
}

export function scoreLine(deal: BriefingDeal): string {
  return `${pyFixed(deal.o1_score, 1)} % · ${deal.o1_assessment}`;
}
