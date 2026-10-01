/** Hard filters: stage, geography and ticket fit (spec §3). */

import type { HardFilterRules } from "./config";

export const OUTSIDE_STAGE = "outside_stage";
export const OUTSIDE_GEOGRAPHY = "outside_geography";
export const TICKET_MISMATCH = "ticket_mismatch";

/** Skarv's implied ticket = round size × ``implied_ticket_share`` (40 % by default). */
export function impliedTicketEur(roundSizeEur: number | null, rules: HardFilterRules): number | null {
  if (roundSizeEur === null) return null;
  return roundSizeEur * rules.implied_ticket_share;
}

/** Return the first failing pass code, or ``""`` when the company passes every filter. */
export function hardFilterPassCode(
  stage: string,
  country: string,
  roundSizeEur: number | null,
  rules: HardFilterRules,
): string {
  if (!rules.stages.includes(stage)) return OUTSIDE_STAGE;
  const allowedCountries = new Set(Object.values(rules.countries).flat());
  if (!allowedCountries.has(country)) return OUTSIDE_GEOGRAPHY;
  const ticket = impliedTicketEur(roundSizeEur, rules);
  if (ticket === null || !(rules.ticket_min_eur <= ticket && ticket <= rules.ticket_max_eur)) {
    return TICKET_MISMATCH;
  }
  return "";
}
