/** Company scoring (spec §4, §10) — above all: time in queue never changes the score. */

import { describe, expect, it } from "vitest";

import { loadThesisKeywords, loadTriageConfig } from "@/lib/triage/config";
import { pyRound } from "@/lib/triage/py";
import {
  DECIDE_THIS_WEEK,
  DECISION_REQUIRED,
  momentumFromSignals,
  queueFlag,
  scoreCompany,
  sourceQualityFromChannels,
  suggestThesisFit,
} from "@/lib/triage/scoring";

const CONFIG = loadTriageConfig();
const WEIGHTS = CONFIG.weights;

function components(overrides: Record<string, unknown> = {}) {
  return { thesis_fit: 3, market: null, team: null, momentum: 1, source_quality: 3, ...overrides };
}

describe("scoring", () => {
  it("is not affected by time in queue", () => {
    const fresh = components({ first_seen_at: "2026-09-29", days_in_queue: 1 });
    const stale = components({ first_seen_at: "2026-06-01", days_in_queue: 121 });
    expect(scoreCompany(fresh, WEIGHTS)).toEqual(scoreCompany(stale, WEIGHTS));
  });

  it("raises queue flags instead", () => {
    const flags = CONFIG.queue_flags;
    expect(queueFlag(13, flags)).toBe("");
    expect(queueFlag(14, flags)).toBe(DECIDE_THIS_WEEK);
    expect(queueFlag(21, flags)).toBe(DECISION_REQUIRED);
  });

  it("adds nothing for unrated human fields, and says so", () => {
    const [, breakdown] = scoreCompany(components(), WEIGHTS);
    const byComponent = Object.fromEntries(breakdown.map((row) => [row.component, row]));
    for (const humanOnly of ["market", "team"]) {
      expect(byComponent[humanOnly].value).toBeNull();
      expect(byComponent[humanOnly].points).toBe(0);
      expect(byComponent[humanOnly].note).toBe("Not yet rated (human only)");
    }
  });

  it("is the weighted sum of the breakdown", () => {
    const [score, breakdown] = scoreCompany(components({ market: 2, team: 3 }), WEIGHTS);
    expect(score).toBe(pyRound(breakdown.reduce((sum, row) => sum + row.points, 0), 2));
    expect(breakdown.map((row) => row.component)).toEqual([
      "thesis_fit",
      "market",
      "team",
      "momentum",
      "source_quality",
    ]);
  });

  it("rises with a human rating", () => {
    const [unrated] = scoreCompany(components(), WEIGHTS);
    const [rated] = scoreCompany(components({ market: 3 }), WEIGHTS);
    expect(rated).toBeGreaterThan(unrated);
  });

  it("marks thesis fit suggested until confirmed", () => {
    const [, suggested] = scoreCompany(components(), WEIGHTS);
    const [, confirmed] = scoreCompany(components(), WEIGHTS, true);
    expect(suggested[0].note.startsWith("Suggested")).toBe(true);
    expect(confirmed[0].note).toBe("Confirmed");
  });

  it("suggests thesis fit from the thesis keywords", () => {
    const keywords = loadThesisKeywords();
    expect(suggestThesisFit("Warehouse robotics for mid-size factories", keywords)).toBe(3);
    expect(suggestThesisFit("Workflow SaaS for construction firms", keywords)).toBe(2);
    expect(suggestThesisFit("A consumer dating app", keywords)).toBe(1);
    expect(suggestThesisFit("", keywords)).toBe(1);
  });

  it("ranks a warm intro above cold inbound", () => {
    const quality = CONFIG.source_quality;
    expect(sourceQualityFromChannels(["website_form", "warm_intro"], quality)).toBeGreaterThan(
      sourceQualityFromChannels(["website_form", "cold_email"], quality),
    );
  });

  it("counts hire, traction and news for momentum, capped", () => {
    expect(momentumFromSignals(["senior_hire", "news", "round_announced"], 3)).toBe(2);
    expect(momentumFromSignals(Array(10).fill("news"), 3)).toBe(3);
  });
});
