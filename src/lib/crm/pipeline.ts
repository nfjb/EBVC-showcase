/**
 * The triage pipeline behind a deal-flow upload: rebuild the CRM from the inbound CSV and
 * the signals CSV, and record the run.
 */

import inboundDemo from "../../../demo/inbound_records.csv?raw";
import signalsDemo from "../../../demo/signals.csv?raw";

import { atomic } from "@/lib/db/connection";
import * as repo from "@/lib/db/repository";
import { loadTriageConfig } from "@/lib/triage/config";
import { planPipeline } from "@/lib/triage/pipeline";

export interface PipelineCounts {
  raw_records: number;
  companies: number;
  suggested_merges: number;
  passed_filters: number;
}

/**
 * Rebuild the CRM from the uploaded files and return the stage counts.
 *
 * Both files are read and every company worked out before anything is written; the
 * rebuild itself is one transaction, so a bad file never leaves the CRM half-replaced.
 * Bulk loads write no Decision rows: the audit log is for people's clicks.
 */
export function runPipeline(inboundText: string, signalsText: string): PipelineCounts {
  const plan = planPipeline(inboundText, signalsText, loadTriageConfig());

  const counts = atomic(() => {
    repo.clearCrm();
    const companyIds = plan.companies.map(({ fields, touchpoints }) => {
      const companyId = repo.insertCompany(fields);
      for (const touchpoint of touchpoints) repo.insertTouchpoint(companyId, touchpoint);
      return companyId;
    });
    for (const suggestion of plan.suggestions) {
      repo.insertMergeSuggestion(
        companyIds[suggestion.first_group],
        companyIds[suggestion.second_group],
        suggestion.similarity,
      );
    }
    return {
      raw_records: plan.records.length,
      companies: plan.companies.length,
      suggested_merges: plan.suggestions.length,
      passed_filters: plan.companies.filter(({ fields }) => fields.passed_hard_filters).length,
    };
  });

  return counts;
}

export interface UploadInput {
  inbound: { name: string; text: string } | null;
  signals: { name: string; text: string } | null;
  uploadedBy: string;
}

export type UploadResult = { ok: true; id: number; counts: PipelineCounts } | { ok: false; id: number | null; error: string };

/**
 * A deal-flow upload: run the pipeline and record the counts (or the error). Only the file
 * names are kept; the CRM lives in this browser tab, so nothing is written anywhere.
 */
export function createUpload({ inbound, signals, uploadedBy }: UploadInput): UploadResult {
  if (!inbound || !signals) {
    return { ok: false, id: null, error: "Upload both the inbound CSV and the signals CSV." };
  }
  const record = {
    inbound_file: inbound.name,
    signals_file: signals.name,
    uploaded_by: uploadedBy,
    created_at: new Date().toISOString(),
  };
  try {
    const counts = runPipeline(inbound.text, signals.text);
    const id = repo.insertUpload({
      ...record,
      raw_record_count: counts.raw_records,
      company_count: counts.companies,
      suggested_merge_count: counts.suggested_merges,
      passed_filter_count: counts.passed_filters,
      status: "success",
      error: "",
    });
    return { ok: true, id, counts };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const id = repo.insertUpload({
      ...record,
      raw_record_count: 0,
      company_count: 0,
      suggested_merge_count: 0,
      passed_filter_count: 0,
      status: "error",
      error: message,
    });
    return { ok: false, id, error: message };
  }
}

/** The bundled demo files (``demo/inbound_records.csv`` and ``demo/signals.csv``). */
export function demoFiles(): { inbound: { name: string; text: string }; signals: { name: string; text: string } } {
  return {
    inbound: { name: "inbound_records.csv", text: inboundDemo },
    signals: { name: "signals.csv", text: signalsDemo },
  };
}

/** Who the automatic demo load is logged under on Deal flow uploads. */
export const DEMO_LOADER = "Demo data (loaded when the app opened)";

/**
 * Load the bundled demo files into an empty CRM, once per tab, so the app opens with deals
 * to triage. A bulk load like any upload: it writes no Decision rows.
 */
export function loadDemoIfEmpty(): void {
  if (repo.countCompanies() || repo.listUploads().length) return;
  createUpload({ ...demoFiles(), uploadedBy: DEMO_LOADER });
}
