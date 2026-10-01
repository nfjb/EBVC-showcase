/** Smoke tests: the store persists, and an upload refuses missing files. */

import os from "node:os";
import path from "node:path";
import fs from "node:fs";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import * as repo from "@/lib/db/repository";
import { createUpload } from "@/lib/server/pipeline";
import type { CompanyFields } from "@/lib/triage/pipeline";

import { demoTexts, freshDatabase } from "./helpers";

let uploads: string;

beforeEach(() => {
  freshDatabase();
  uploads = fs.mkdtempSync(path.join(os.tmpdir(), "skarv-uploads-"));
  process.env.UPLOADS_DIR = uploads;
});

afterEach(() => {
  delete process.env.UPLOADS_DIR;
  fs.rmSync(uploads, { recursive: true, force: true });
});

const blank: CompanyFields = {
  name: "Smoke Test Company",
  website_domain: "",
  country: "DK",
  stage: "Seed",
  round_size_eur: null,
  one_liner: "",
  deck_text: "",
  first_seen_at: null,
  touchpoint_count: 0,
  owner: "",
  status: "open",
  passed_hard_filters: false,
  pass_code: "",
  thesis_fit: null,
  thesis_fit_confirmed: false,
  market: null,
  team: null,
  momentum: 0,
  source_quality: 0,
  score: 0,
  score_breakdown: "[]",
  latest_signal: "",
  latest_signal_at: null,
  rank_override: null,
  rank_override_comment: "",
};

describe("smoke", () => {
  it("round-trips a company", () => {
    const id = repo.insertCompany(blank);
    expect(repo.getCompany(id)!.name).toBe("Smoke Test Company");
    repo.deleteCompany(id);
    expect(repo.getCompany(id)).toBeNull();
  });

  it("refuses an upload without both files", () => {
    const result = createUpload({ inbound: null, signals: null, uploadedBy: "Astrid Holm (demo)" });
    expect(result).toEqual({ ok: false, id: null, error: "Upload both the inbound CSV and the signals CSV." });
    expect(repo.listUploads()).toEqual([]);
  });

  it("records a successful upload with its counts and keeps both files", () => {
    const [inbound, signals] = demoTexts();
    const result = createUpload({
      inbound: { name: "inbound_records.csv", text: inbound },
      signals: { name: "signals.csv", text: signals },
      uploadedBy: "Astrid Holm (demo)",
    });
    expect(result.ok).toBe(true);
    const [upload] = repo.listUploads();
    expect(upload.status).toBe("success");
    expect(upload.raw_record_count).toBe(412);
    expect(upload.company_count).toBe(repo.countCompanies());
    expect(fs.readdirSync(uploads)).toHaveLength(2);
  });

  it("records a failed upload with its error and changes nothing", () => {
    const result = createUpload({
      inbound: { name: "bad.csv", text: "a,b\n1,2\n" },
      signals: { name: "signals.csv", text: demoTexts()[1] },
      uploadedBy: "Astrid Holm (demo)",
    });
    expect(result.ok).toBe(false);
    expect(repo.listUploads()[0].status).toBe("error");
    expect(repo.countCompanies()).toBe(0);
  });
});
