/**
 * Company scoring on the O1 Venture investment criteria (Pre-Seed / Seed, March 2026), with
 * visible weights and a per-deal breakdown (spec §4).
 *
 * Only companies are scored. Every dimension is a human rating (1–5): the pipeline never
 * fills one, and an unrated dimension adds nothing. Time in queue is not an input to the
 * score — it only raises the 14/21-day flags in {@link queueFlag}.
 */

import type { O1Rules } from "./config";
import { pyRound } from "./py";

/** The ten O1 dimensions in the framework's order, with what a person assesses for each. */
export const O1_DIMENSIONS = [
  {
    key: "team",
    label: "Team",
    assesses: "Founder track record and founder–market fit, clear roles, full-time commitment, tech and commercial skills, execution speed.",
  },
  {
    key: "market",
    label: "Market opportunity",
    assesses: "Size and growth of the market, a bottom-up TAM/SAM/SOM, a clearly segmented customer, why now.",
  },
  {
    key: "problem_solution_fit",
    label: "Problem–solution fit",
    assesses: "A clear, quantified and urgent customer pain, evidence of demand, a solution 10× better rather than a feature.",
  },
  {
    key: "technology_product",
    label: "Technology & product",
    assesses: "Product maturity (live product or demo), technical differentiation, IP, scalable architecture, a clear roadmap.",
  },
  {
    key: "business_model",
    label: "Business model",
    assesses: "A simple revenue model and pricing logic, realistic unit economics, recurring revenue, willingness to pay.",
  },
  {
    key: "traction_validation",
    label: "Traction & validation",
    assesses: "Real usage, MRR or first revenue, customer voices, LOIs and pilots with relevant partners, validation studies.",
  },
  {
    key: "competition",
    label: "Competition & differentiation",
    assesses: "A realistic view of competitors, a strong USP, a technology or data moat, barriers to entry.",
  },
  {
    key: "go_to_market",
    label: "Go-to-market",
    assesses: "A clearly defined ICP, realistic acquisition logic, channels and first experiments, early customer contact.",
  },
  {
    key: "financials",
    label: "Financial plan & use of funds",
    assesses: "A clear cost structure and funding need, transparent use of funds tied to milestones, burn and runway, plausible forecast.",
  },
  {
    key: "exit_potential",
    label: "Exit potential",
    assesses: "Exit paths and active strategic buyers, M&A activity in the market, technology or data of strategic value.",
  },
] as const;

export type O1Dimension = (typeof O1_DIMENSIONS)[number]["key"];
export const O1_KEYS: O1Dimension[] = O1_DIMENSIONS.map((dimension) => dimension.key);
export const STORYTELLING = "storytelling_bonus";

/** One rating per dimension (1–5, or null until a person rates it) plus the 0–5 bonus. */
export type O1Ratings = Record<O1Dimension, number | null> & { storytelling_bonus: number | null };

export const DECIDE_THIS_WEEK = "Decide this week";
export const DECISION_REQUIRED = "Decision required at next meeting";

export interface BreakdownRow {
  component: O1Dimension | typeof STORYTELLING;
  value: number | null;
  /** Weight in % (0 for the storytelling bonus). */
  weight: number;
  /** Percentage points this row adds to the score. */
  points: number;
  note: string;
}

export function emptyRatings(): O1Ratings {
  return { ...(Object.fromEntries(O1_KEYS.map((key) => [key, null])) as Record<O1Dimension, null>), storytelling_bonus: null };
}

/** The ratings stored on a company row (other fields are ignored). */
export function ratingsOf(company: object): O1Ratings {
  const fields = company as Record<string, unknown>;
  const ratings = emptyRatings();
  for (const key of [...O1_KEYS, STORYTELLING] as const) {
    const value = fields[key];
    ratings[key] = value === null || value === undefined ? null : Number(value);
  }
  return ratings;
}

export function ratedCount(company: object): number {
  const ratings = ratingsOf(company);
  return O1_KEYS.filter((key) => ratings[key] !== null).length;
}

function checkWeights(rules: O1Rules): void {
  for (const key of O1_KEYS) {
    if (!(key in rules.weights)) throw new Error(`Missing O1 weight for ${key} in config/weights.yaml`);
  }
  const total = O1_KEYS.reduce((sum, key) => sum + Number(rules.weights[key]), 0);
  if (pyRound(total, 6) !== 100) throw new Error(`O1 weights in config/weights.yaml add up to ${total}, not 100`);
}

/**
 * Return ``[score %, breakdown]``. Reads only the ten O1 ratings and the storytelling bonus.
 *
 * ``components`` may carry any other company fields (days in queue, dates…); they are
 * ignored, which is what keeps time in queue out of the score.
 */
export function scoreCompany(components: object, rules: O1Rules): [number, BreakdownRow[]] {
  checkWeights(rules);
  const ratings = ratingsOf(components);
  const breakdown: BreakdownRow[] = [];
  let total = 0;
  for (const key of O1_KEYS) {
    const value = ratings[key];
    const weight = Number(rules.weights[key]);
    const points = value === null ? 0 : (weight * value) / rules.scale_max;
    total += points;
    breakdown.push({ component: key, value, weight, points, note: value === null ? "Not yet rated" : "" });
  }
  const bonus = ratings.storytelling_bonus;
  total += bonus ?? 0;
  breakdown.push({
    component: STORYTELLING,
    value: bonus,
    weight: 0,
    points: bonus ?? 0,
    note: bonus === null ? "Not yet rated (bonus, optional)" : "Bonus points",
  });
  return [pyRound(Math.min(total, 100), 1), breakdown];
}

/** The O1 interpretation of a score, or a provisional note while dimensions are unrated. */
export function scoreBand(score: number, rated: number, rules: O1Rules): string {
  if (rated < O1_KEYS.length) return `Provisional – ${rated} of ${O1_KEYS.length} rated`;
  return rules.bands.find((band) => score >= band.min)?.label ?? rules.bands[rules.bands.length - 1].label;
}

export function queueFlag(
  daysInQueue: number,
  flags: { decide_this_week_days: number; decision_required_days: number },
): string {
  if (daysInQueue >= flags.decision_required_days) return DECISION_REQUIRED;
  if (daysInQueue >= flags.decide_this_week_days) return DECIDE_THIS_WEEK;
  return "";
}
