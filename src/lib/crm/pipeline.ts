/**
 * The triage pipeline behind a deal-flow upload: rebuild the CRM from the inbound CSV and
 * the signals CSV, and record the run.
 */

import fs from "node:fs";
import path from "node:path";

import { atomic } from "@/lib/db/connection";
import * as repo from "@/lib/db/repository";
import { loadThesisKeywords, loadTriageConfig } from "@/lib/triage/config";
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
  const plan = planPipeline(inboundText, signalsText, loadTriageConfig(), loadThesisKeywords());

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

  console.info("Deal-flow pipeline run");
  console.table(Object.entries(counts).map(([Stage, Count]) => ({ Stage, Count })));
  return counts;
}

export function uploadsDirectory(): string {
  return process.env.UPLOADS_DIR ?? path.join(process.cwd(), "dealflow_uploads");
}

function storeFile(fileName: string, contents: string, stamp: string): string {
  const safeName = path.basename(fileName).replace(/[^\w.-]+/g, "_") || "upload.csv";
  const stored = path.join(uploadsDirectory(), `${stamp}-${safeName}`);
  fs.mkdirSync(path.dirname(stored), { recursive: true });
  fs.writeFileSync(stored, contents, "utf-8");
  return path.relative(process.cwd(), stored);
}

export interface UploadInput {
  inbound: { name: string; text: string } | null;
  signals: { name: string; text: string } | null;
  uploadedBy: string;
}

export type UploadResult = { ok: true; id: number; counts: PipelineCounts } | { ok: false; id: number | null; error: string };

/** A deal-flow upload: keep both files, run the pipeline, record the counts (or the error). */
export function createUpload({ inbound, signals, uploadedBy }: UploadInput): UploadResult {
  if (!inbound || !signals) {
    return { ok: false, id: null, error: "Upload both the inbound CSV and the signals CSV." };
  }
  const createdAt = new Date().toISOString();
  const stamp = createdAt.replace(/[:.]/g, "-");
  const inboundFile = storeFile(inbound.name, inbound.text, stamp);
  const signalsFile = storeFile(signals.name, signals.text, stamp);
  const record = {
    inbound_file: inboundFile,
    signals_file: signalsFile,
    uploaded_by: uploadedBy,
    created_at: createdAt,
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
  const demo = path.join(process.cwd(), "demo");
  return {
    inbound: { name: "inbound_records.csv", text: fs.readFileSync(path.join(demo, "inbound_records.csv"), "utf-8") },
    signals: { name: "signals.csv", text: fs.readFileSync(path.join(demo, "signals.csv"), "utf-8") },
  };
}
