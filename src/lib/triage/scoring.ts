/**
 * Company scoring with visible weights and a per-deal breakdown (spec §4).
 *
 * Only companies are scored. ``market`` and ``team`` are human-only ratings: an empty
 * rating adds nothing, and nothing here ever fills ``team``. Time in queue is not an input
 * to the score — it only raises the 14/21-day flags in {@link queueFlag}.
 */

import type { ThesisKeywords } from "./config";
import { escapeRegExp, PY_WORD_CLASS, pyRound } from "./py";

export const SCORED_COMPONENTS = ["thesis_fit", "market", "team", "momentum", "source_quality"] as const;
export type ScoredComponent = (typeof SCORED_COMPONENTS)[number];
export const MOMENTUM_SIGNAL_TYPES = new Set(["senior_hire", "traction_update", "news"]);

export const DECIDE_THIS_WEEK = "Decide this week";
export const DECISION_REQUIRED = "Decision required at next meeting";

export interface BreakdownRow {
  component: ScoredComponent;
  value: number | null;
  weight: number;
  points: number;
  note: string;
}

const WORD_CHAR = new RegExp(`[${PY_WORD_CLASS}]`, "u");

/** Python's ``\b{keyword}\b`` with Unicode word characters. */
function mentionPattern(keyword: string): RegExp {
  const characters = Array.from(keyword);
  // \b before a word character means "not after a word character", and vice versa.
  const before = WORD_CHAR.test(characters[0] ?? "") ? `(?<![${PY_WORD_CLASS}])` : `(?<=[${PY_WORD_CLASS}])`;
  const after = WORD_CHAR.test(characters[characters.length - 1] ?? "")
    ? `(?![${PY_WORD_CLASS}])`
    : `(?=[${PY_WORD_CLASS}])`;
  return new RegExp(`${before}${escapeRegExp(keyword)}${after}`, "u");
}

function mentions(text: string, keyword: string): boolean {
  return mentionPattern(keyword).test(text);
}

/**
 * Deterministic 1–3 suggestion from the deck text against config/thesis.md.
 *
 * 3 = mentions a core thesis area, 2 = adjacent, 1 = outside or no match.
 * Always a suggestion: a person confirms it before it counts as confirmed.
 */
export function suggestThesisFit(deckText: string, keywords: ThesisKeywords): number {
  const text = (deckText || "").toLowerCase();
  if (keywords.outside.some((keyword) => mentions(text, keyword))) return 1;
  if (keywords.strong.some((keyword) => mentions(text, keyword))) return 3;
  if (keywords.partial.some((keyword) => mentions(text, keyword))) return 2;
  return 1;
}

export function momentumFromSignals(signalTypes: string[], cap: number): number {
  return Math.min(cap, signalTypes.filter((signalType) => MOMENTUM_SIGNAL_TYPES.has(signalType)).length);
}

export function sourceQualityFromChannels(channels: string[], qualityByChannel: Record<string, number>): number {
  return channels.reduce(
    (best, channel) => Math.max(best, Object.hasOwn(qualityByChannel, channel) ? qualityByChannel[channel] : 0),
    channels.length ? -Infinity : 0,
  );
}

/**
 * Return ``[score, breakdown]``. Reads only the five scored components.
 *
 * ``components`` may carry any other company fields (days in queue, dates…); they are
 * ignored, which is what keeps time in queue out of the score.
 */
export function scoreCompany(
  components: Partial<Record<string, unknown>>,
  weights: Record<string, number>,
  thesisFitConfirmed = false,
): [number, BreakdownRow[]] {
  const breakdown: BreakdownRow[] = [];
  let total = 0;
  for (const component of SCORED_COMPONENTS) {
    const raw = components[component];
    const value = raw === null || raw === undefined ? null : (raw as number);
    if (!(component in weights)) throw new Error(`Missing weight for ${component} in config/weights.yaml`);
    const weight = Number(weights[component]);
    const points = value === null ? 0 : value * weight;
    total += points;
    let note: string;
    if (value === null) note = "Not yet rated (human only)";
    else if (component === "thesis_fit") note = thesisFitConfirmed ? "Confirmed" : "Suggested, awaiting confirmation";
    else note = "";
    breakdown.push({ component, value, weight, points, note });
  }
  return [pyRound(total, 2), breakdown];
}

export function queueFlag(
  daysInQueue: number,
  flags: { decide_this_week_days: number; decision_required_days: number },
): string {
  if (daysInQueue >= flags.decision_required_days) return DECISION_REQUIRED;
  if (daysInQueue >= flags.decide_this_week_days) return DECIDE_THIS_WEEK;
  return "";
}
