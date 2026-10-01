/**
 * Hard filters on stage, geography and ticket fit (spec §3, §10).
 *
 * Ticket rule (user decision 2026-09-30): implied ticket = 40 % of the round, which must be
 * within EUR 0.5–2m, so rounds of EUR 1.25m–5m pass.
 */

import { describe, expect, it } from "vitest";

import { loadTriageConfig } from "@/lib/triage/config";
import { hardFilterPassCode, OUTSIDE_GEOGRAPHY, OUTSIDE_STAGE, TICKET_MISMATCH } from "@/lib/triage/filters";

const RULES = loadTriageConfig().hard_filters;

describe("hard filters", () => {
  const inScope = ["Pre-Seed", "Seed"].flatMap((stage) =>
    ["DK", "SE", "NO", "FI", "IS", "DE", "AT", "CH"].map((country) => [stage, country]),
  );
  it.each(inScope)("%s in %s passes", (stage, country) => {
    expect(hardFilterPassCode(stage, country, 3_000_000, RULES)).toBe("");
  });

  it.each(["Series A", "Series B", "Growth", ""])("stage %j fails as outside_stage", (stage) => {
    expect(hardFilterPassCode(stage, "DK", 3_000_000, RULES)).toBe(OUTSIDE_STAGE);
  });

  it.each(["US", "GB", "FR", "NL", ""])("country %j outside the Nordics and DACH fails", (country) => {
    expect(hardFilterPassCode("Seed", country, 3_000_000, RULES)).toBe(OUTSIDE_GEOGRAPHY);
  });

  it.each([1_250_000, 5_000_000])("ticket range boundary %d is inclusive", (roundSize) => {
    expect(hardFilterPassCode("Seed", "DE", roundSize, RULES)).toBe("");
  });

  it.each([1_000_000, 6_000_000, null])("round %j implying a ticket outside the range fails", (roundSize) => {
    expect(hardFilterPassCode("Seed", "DE", roundSize, RULES)).toBe(TICKET_MISMATCH);
  });

  it("checks stage before geography and ticket", () => {
    expect(hardFilterPassCode("Series B", "US", 50_000_000, RULES)).toBe(OUTSIDE_STAGE);
  });

  it("reads Norway as a country code, not as false (the YAML 1.1 'Norway problem')", () => {
    expect(Object.values(RULES.countries).flat()).toContain("NO");
  });
});
