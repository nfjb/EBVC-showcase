/**
 * The CRM records, field for field as they are stored (see ``src/lib/db/schema.ts``).
 *
 * Dates are ``YYYY-MM-DD`` strings; timestamps are ISO-8601 strings in UTC.
 */

import type { IsoDate } from "./dates";

/** One merged company in the Skarv CRM (one row per company, spec §2). */
export interface Company {
  id: number;
  name: string;
  website_domain: string;
  country: string;
  stage: string;
  round_size_eur: number | null;
  one_liner: string;
  deck_text: string;
  first_seen_at: IsoDate | null;
  touchpoint_count: number;
  /** The person originally contacted (first touchpoint's recipient). */
  owner: string;
  /** open / advanced / passed */
  status: "open" | "advanced" | "passed" | string;
  passed_hard_filters: boolean;
  /** Hard-filter failure or the pass code a person chose when passing the deal. */
  pass_code: string;
  // The Fathom ratings, 1–5 each, set only by a person (null until rated).
  team: number | null;
  market: number | null;
  problem_solution_fit: number | null;
  technology_product: number | null;
  business_model: number | null;
  traction_validation: number | null;
  competition: number | null;
  go_to_market: number | null;
  financials: number | null;
  exit_potential: number | null;
  /** Storytelling & design: 0–5 bonus points on top of the score. */
  storytelling_bonus: number | null;
  /** Who set the Fathom ratings: "agent" (the Fathom rating agent), "person", or "" (unrated). */
  rating_source: "" | "agent" | "person" | string;
  /** The agent's three-sentence justification (kept when a person changes the ratings). */
  rating_rationale: string;
  /** The AI model behind the agent's ratings, or "". */
  rating_model: string;
  /** Who last set the ratings ("Fathom agent" or "<name> (demo)"), and when (ISO, UTC). */
  rated_by: string;
  rated_at: string | null;
  /** The Fathom score in % (0–100). */
  score: number;
  /** JSON list of {component, value, weight, points, note}. */
  score_breakdown: string;
  latest_signal: string;
  latest_signal_at: IsoDate | null;
  /** senior_hire, traction_update, round_announced or news ("" without a signal). */
  latest_signal_type: string;
  rank_override: number | null;
  rank_override_comment: string;
}

/** One original inbound record, kept exactly as it arrived (spec §2). */
export interface Touchpoint {
  id: number;
  company_id: number;
  record_id: string;
  /** website_form / cold_email / linkedin / warm_intro */
  channel: string;
  received_at: IsoDate;
  recipient: string;
  company_name: string;
  website: string;
  founder_name: string;
  founder_email: string;
  founder_linkedin: string;
  country: string;
  stage: string;
  round_size_eur: number | null;
  one_liner: string;
  deck_text: string;
  introducer_name: string;
  /** LP / portfolio_founder / angel / none */
  introducer_type: string;
  /** open / replied / closed for a warm intro, empty for every other channel. */
  intro_status: string;
  intro_replied_at: IsoDate | null;
}

export type CompanyWithTouchpoints = Company & { touchpoints: Touchpoint[] };

/** A fuzzy company-name match waiting for a person (spec §2). */
export interface MergeSuggestion {
  id: number;
  company_id: number;
  candidate_id: number;
  similarity: number;
  /** pending / approved / rejected */
  status: string;
  decided_by: string;
  decided_at: string | null;
}

/** The audit log of human clicks (spec §8). */
export interface Decision {
  id: number;
  company_id: number | null;
  company_name: string;
  decision: string;
  pass_code: string;
  comment: string;
  decided_by: string;
  decided_at: string;
}

/** A reply "sent" from the app. Simulated: nothing ever leaves the app. */
export interface OutboxMessage {
  id: number;
  company_id: number | null;
  company_name: string;
  /** intro_reply / pass / introducer_thanks */
  kind: string;
  recipient_name: string;
  recipient_address: string;
  subject: string;
  body: string;
  sent_by: string;
  sent_at: string;
}

/** One run of the triage pipeline over an uploaded inbound CSV and signals CSV. */
export interface DealFlowUpload {
  id: number;
  inbound_file: string;
  signals_file: string;
  raw_record_count: number;
  company_count: number;
  suggested_merge_count: number;
  passed_filter_count: number;
  /** success / error */
  status: string;
  error: string;
  uploaded_by: string;
  created_at: string;
}
