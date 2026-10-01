/**
 * Company scoring on the O1 investment criteria (spec §4, §10) — above all: time in queue
 * never changes the score, and an unrated dimension adds nothing.
 */

import { describe, expect, it } from "vitest";

import { loadTriageConfig } from "@/lib/triage/config";
import { pyRound } from "@/lib/triage/py";
import {
  DECIDE_THIS_WEEK,
  DECISION_REQUIRED,
  emptyRatings,
  O1_KEYS,
  queueFlag,
  ratedCount,
  scoreBand,
  scoreCompany,
  type O1Ratings,
} from "@/lib/triage/scoring";

const CONFIG = loadTriageConfig();
const O1 = CONFIG.o1;

/** Every dimension rated ``value`` (bonus unrated), with ``overrides`` on top. */
function rated(value: number | null, overrides: Partial<O1Ratings> = {}): O1Ratings {
  const ratings = emptyRatings();
  for (const key of O1_KEYS) ratings[key] = value;
  return { ...ratings, ...overrides };
}

describe("O1 scoring", () => {
  it("uses the framework's weights, which add up to 100 %", () => {
    expect(O1.weights).toEqual({
      team: 20,
      market: 15,
      problem_solution_fit: 15,
      technology_product: 10,
      business_model: 10,
      traction_validation: 10,
      competition: 5,
      go_to_market: 5,
      financials: 5,
      exit_potential: 5,
    });
    expect(O1.scale_max).toBe(5);
    expect(O1.storytelling_bonus_max).toBe(5);
  });

  it("is not affected by time in queue", () => {
    const fresh = { ...rated(3), first_seen_at: "2026-09-29", days_in_queue: 1 };
    const stale = { ...rated(3), first_seen_at: "2026-06-01", days_in_queue: 121 };
    expect(scoreCompany(fresh, O1)).toEqual(scoreCompany(stale, O1));
  });

  it("raises queue flags instead", () => {
    const flags = CONFIG.queue_flags;
    expect(queueFlag(13, flags)).toBe("");
    expect(queueFlag(14, flags)).toBe(DECIDE_THIS_WEEK);
    expect(queueFlag(21, flags)).toBe(DECISION_REQUIRED);
  });

  it("starts at 0 % with every dimension unrated, and says so", () => {
    const [score, breakdown] = scoreCompany(emptyRatings(), O1);
    expect(score).toBe(0);
    for (const row of breakdown.filter((item) => item.component !== "storytelling_bonus")) {
      expect(row.value).toBeNull();
      expect(row.points).toBe(0);
      expect(row.note).toBe("Not yet rated");
    }
  });

  it("is the weighted sum of rating / 5, in the framework's order", () => {
    // team 5 → 20, market 4 → 12, the rest 3 → 60 % of their 65 = 39.
    const [score, breakdown] = scoreCompany(rated(3, { team: 5, market: 4 }), O1);
    expect(score).toBe(71);
    expect(score).toBe(pyRound(breakdown.reduce((sum, row) => sum + row.points, 0), 1));
    expect(breakdown.map((row) => row.component)).toEqual([...O1_KEYS, "storytelling_bonus"]);
    expect(scoreCompany(rated(5), O1)[0]).toBe(100);
    expect(scoreCompany(rated(1), O1)[0]).toBe(20);
  });

  it("adds an unrated dimension as nothing, not as an average", () => {
    const [partial] = scoreCompany(rated(5, { exit_potential: null }), O1);
    expect(partial).toBe(95);
  });

  it("adds the storytelling bonus on top, capped at 100 %", () => {
    expect(scoreCompany(rated(3, { storytelling_bonus: 4 }), O1)[0]).toBe(64);
    expect(scoreCompany(rated(5, { storytelling_bonus: 5 }), O1)[0]).toBe(100);
  });

  it("reads the O1 band only once all ten dimensions are rated", () => {
    expect(scoreBand(0, 0, O1)).toBe("Provisional – 0 of 10 rated");
    expect(scoreBand(95, ratedCount(rated(5, { team: null })), O1)).toBe("Provisional – 9 of 10 rated");
    expect(scoreBand(90, 10, O1)).toBe("Investable – strong");
    expect(scoreBand(89.9, 10, O1)).toBe("Investable, minor gaps");
    expect(scoreBand(75, 10, O1)).toBe("Investable, minor gaps");
    expect(scoreBand(60, 10, O1)).toBe("Watchlist – gaps remain");
    expect(scoreBand(40, 10, O1)).toBe("Not investable – too many open questions");
    expect(scoreBand(39.9, 10, O1)).toBe("No fit – fundamentally unsuitable");
  });

  it("refuses weights that do not add up to 100", () => {
    const broken = { ...O1, weights: { ...O1.weights, team: 25 } };
    expect(() => scoreCompany(rated(3), broken)).toThrow(/add up to 105/);
  });
});
