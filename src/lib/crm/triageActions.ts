/**
 * Human actions behind the buttons (spec §4, §5, §8).
 *
 * Every function here is called from a person's click and writes a Decision row (who,
 * when, decision, pass code). None of them is called by the pipeline. Each runs in one
 * transaction: if the Decision cannot be written, nothing else is saved either.
 */

import { atomic } from "@/lib/db/connection";
import * as repo from "@/lib/db/repository";
import { demoToday, loadTriageConfig } from "@/lib/triage/config";
import { daysBetween } from "@/lib/triage/dates";
import { PASS_CODES } from "@/lib/triage/drafts";
import { ActionRefused } from "@/lib/triage/errors";
import { pyFixed, pyStrip } from "@/lib/triage/py";
import { scoreCompany, sourceQualityFromChannels } from "@/lib/triage/scoring";
import type { Company, CompanyWithTouchpoints, MergeSuggestion } from "@/lib/triage/types";
import { buildLine, rankByPriority } from "@/lib/triage/urgency";

export { PASS_CODES };
export const INTRO_STATUSES = ["open", "replied", "closed"];

function now(): string {
  return new Date().toISOString();
}

export function requireCompany(companyId: number): Company {
  const company = repo.getCompany(companyId);
  if (!company) throw new ActionRefused("This company no longer exists (it may have been merged or re-uploaded).");
  return company;
}

export function logDecision(
  company: Pick<Company, "id" | "name">,
  decision: string,
  decidedBy: string,
  passCode = "",
  comment = "",
): number {
  if (!decidedBy) throw new ActionRefused("A decision needs the name of the person making it.");
  return repo.insertDecision({
    company_id: company.id,
    company_name: company.name,
    decision,
    pass_code: passCode,
    comment,
    decided_by: decidedBy,
    decided_at: now(),
  });
}

/** Recompute score and breakdown from the stored components (never from queue time). */
export function rescore(company: Company): Pick<Company, "score" | "score_breakdown"> {
  const [score, breakdown] = scoreCompany(
    {
      thesis_fit: company.thesis_fit,
      market: company.market,
      team: company.team,
      momentum: company.momentum,
      source_quality: company.source_quality,
    },
    loadTriageConfig().weights,
    company.thesis_fit_confirmed,
  );
  return { score, score_breakdown: JSON.stringify(breakdown) };
}

function checkRating(value: number | null, label: string): void {
  if (value !== null && ![1, 2, 3].includes(value)) throw new ActionRefused(`${label} must be 1, 2 or 3.`);
}

/** A person confirms thesis fit and rates market and team (team is only ever set here). */
export function saveRatings(
  companyId: number,
  thesisFit: number,
  market: number | null,
  team: number | null,
  decidedBy: string,
): void {
  for (const [value, label] of [
    [thesisFit, "Thesis fit"],
    [market, "Market"],
    [team, "Team"],
  ] as const) {
    checkRating(value, label);
  }
  atomic(() => {
    const company = requireCompany(companyId);
    const rated: Company = { ...company, thesis_fit: thesisFit, thesis_fit_confirmed: true, market, team };
    repo.updateCompany(companyId, {
      thesis_fit: thesisFit,
      thesis_fit_confirmed: true,
      market,
      team,
      ...rescore(rated),
    });
    logDecision(
      company,
      "rating_changed",
      decidedBy,
      "",
      `thesis fit ${thesisFit} (confirmed), market ${market || "-"}, team ${team || "-"}`,
    );
  });
}

export function advance(companyId: number, decidedBy: string, comment = ""): void {
  atomic(() => {
    const company = requireCompany(companyId);
    repo.updateCompany(companyId, { status: "advanced" });
    logDecision(company, "advance", decidedBy, "", comment);
  });
}

export function passDeal(companyId: number, passCode: string, decidedBy: string, comment = ""): void {
  if (!(PASS_CODES as readonly string[]).includes(passCode)) throw new ActionRefused(`Unknown pass code: ${passCode}.`);
  if (passCode === "other" && !pyStrip(comment)) throw new ActionRefused("Pass code 'other' needs a comment.");
  atomic(() => {
    const company = requireCompany(companyId);
    repo.updateCompany(companyId, { status: "passed", pass_code: passCode });
    logDecision(company, "pass", decidedBy, passCode, comment);
  });
}

/** Pin a company to a worklist position (or clear the pin). A comment is required. */
export function overrideRank(companyId: number, rank: number | null, comment: string, decidedBy: string): void {
  if (!pyStrip(comment)) throw new ActionRefused("A rank override needs a comment.");
  if (rank !== null && rank < 1) throw new ActionRefused("Rank must be 1 or higher.");
  atomic(() => {
    const company = requireCompany(companyId);
    repo.updateCompany(companyId, { rank_override: rank, rank_override_comment: comment });
    logDecision(
      company,
      "rank_override",
      decidedBy,
      "",
      `rank ${rank !== null ? rank : "cleared"}: ${comment}`,
    );
  });
}

function requirePendingSuggestion(suggestionId: number): MergeSuggestion {
  const suggestion = repo.getMergeSuggestion(suggestionId);
  if (!suggestion || suggestion.status !== "pending") {
    throw new ActionRefused("This possible duplicate has already been decided.");
  }
  return suggestion;
}

/** Fold ``candidate`` into ``company``: move its touchpoints, then delete it. */
export function approveMerge(suggestionId: number, decidedBy: string): void {
  const config = loadTriageConfig();
  atomic(() => {
    const suggestion = requirePendingSuggestion(suggestionId);
    const company = requireCompany(suggestion.company_id);
    const candidate = requireCompany(suggestion.candidate_id);
    repo.updateMergeSuggestion(suggestion.id, { status: "approved", decided_by: decidedBy, decided_at: now() });
    logDecision(
      company,
      "merge_approved",
      decidedBy,
      "",
      `merged '${candidate.name}' (similarity ${pyFixed(suggestion.similarity, 2)})`,
    );
    repo.moveTouchpoints(candidate.id, company.id);
    const touchpoints = repo.touchpointsOf(company.id);
    const merged: Company = {
      ...company,
      touchpoint_count: touchpoints.length,
      first_seen_at: touchpoints.reduce(
        (first, touchpoint) => (touchpoint.received_at < first ? touchpoint.received_at : first),
        touchpoints[0].received_at,
      ),
      source_quality: sourceQualityFromChannels(
        touchpoints.map((touchpoint) => touchpoint.channel),
        config.source_quality,
      ),
      momentum: Math.max(company.momentum, candidate.momentum),
      website_domain: company.website_domain || candidate.website_domain,
    };
    repo.updateCompany(company.id, {
      touchpoint_count: merged.touchpoint_count,
      first_seen_at: merged.first_seen_at,
      source_quality: merged.source_quality,
      momentum: merged.momentum,
      website_domain: merged.website_domain,
      ...rescore(merged),
    });
    // Cascades to the candidate's other merge suggestions; its decisions and messages keep its name.
    repo.deleteCompany(candidate.id);
  });
}

export function rejectMerge(suggestionId: number, decidedBy: string): void {
  atomic(() => {
    const suggestion = requirePendingSuggestion(suggestionId);
    const company = requireCompany(suggestion.company_id);
    const candidate = requireCompany(suggestion.candidate_id);
    repo.updateMergeSuggestion(suggestion.id, { status: "rejected", decided_by: decidedBy, decided_at: now() });
    logDecision(company, "merge_rejected", decidedBy, "", `kept '${candidate.name}' separate`);
  });
}

export function setIntroStatus(touchpointId: number, status: string, decidedBy: string): void {
  if (!INTRO_STATUSES.includes(status)) throw new ActionRefused(`Unknown intro status: ${status}.`);
  atomic(() => {
    const touchpoint = repo.getTouchpoint(touchpointId);
    if (!touchpoint) throw new ActionRefused("This intro no longer exists (the deal flow may have been re-uploaded).");
    const company = requireCompany(touchpoint.company_id);
    repo.updateTouchpoint(touchpointId, {
      intro_status: status,
      intro_replied_at: status === "replied" ? demoToday() : null,
    });
    logDecision(
      company,
      status === "replied" ? "intro_replied" : `intro_${status}`,
      decidedBy,
      "",
      `intro from ${touchpoint.introducer_name}`,
    );
  });
}

export function daysInQueue(company: Pick<Company, "first_seen_at">, today: string | null = null): number {
  const day = today ?? demoToday();
  return company.first_seen_at ? daysBetween(company.first_seen_at, day) : 0;
}

/**
 * Open, filter-passing companies ordered by score % × urgency; pinned ranks override.
 * Urgency never includes time in queue (see ``src/lib/triage/urgency.ts``).
 */
export function rankWorklist(companies: CompanyWithTouchpoints[]): CompanyWithTouchpoints[] {
  const candidates = companies.filter((company) => company.status === "open" && company.passed_hard_filters);
  return rankByPriority(candidates.map((company) => buildLine(company))).map((line) => line.company);
}
