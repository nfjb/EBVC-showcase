/** Smoke tests: the store round-trips a company, and an upload refuses missing files. */

import { beforeEach, describe, expect, it } from "vitest";

import * as repo from "@/lib/db/repository";
import { createUpload, DEMO_LOADER, loadDemoIfEmpty } from "@/lib/crm/pipeline";
import type { CompanyFields } from "@/lib/triage/pipeline";

import { demoTexts, freshDatabase } from "./helpers";

beforeEach(() => {
  freshDatabase();
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
  team: null,
  market: null,
  problem_solution_fit: null,
  technology_product: null,
  business_model: null,
  traction_validation: null,
  competition: null,
  go_to_market: null,
  financials: null,
  exit_potential: null,
  storytelling_bonus: null,
  rating_source: "",
  rating_rationale: "",
  rating_model: "",
  rated_by: "",
  rated_at: null,
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

  it("records a successful upload with its counts and file names", () => {
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
    expect([upload.inbound_file, upload.signals_file]).toEqual(["inbound_records.csv", "signals.csv"]);
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

describe("demo data on open", () => {
  it("loads the bundled demo files into an empty CRM, once, without any Decision rows", () => {
    loadDemoIfEmpty();
    expect(repo.countCompanies()).toBeGreaterThan(0);
    expect(repo.listUploads()).toHaveLength(1);
    expect(repo.listUploads()[0].uploaded_by).toBe(DEMO_LOADER);
    expect(repo.listDecisions()).toEqual([]);
    loadDemoIfEmpty();
    expect(repo.listUploads()).toHaveLength(1);
  });
});
