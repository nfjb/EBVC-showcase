/**
 * The pipeline over the generated demo files, and the human actions (spec §1–§5, §8).
 *
 * Every test starts from a fresh CRM. Expected figures come from the spec (412 raw records,
 * 25 warm intros, the Robotix showcase with five arrivals), not from the pipeline's output.
 */

import { beforeEach, describe, expect, it } from "vitest";

import * as repo from "@/lib/db/repository";
import { runPipeline, type PipelineCounts } from "@/lib/crm/pipeline";
import {
  advance,
  approveMerge,
  overrideRank,
  passDeal,
  rankWorklist,
  rejectMerge,
  saveRatings,
  setIntroStatus,
} from "@/lib/crm/triageActions";
import { ActionRefused } from "@/lib/triage/errors";
import { emptyRatings, O1_KEYS } from "@/lib/triage/scoring";
import { OUTSIDE_GEOGRAPHY, OUTSIDE_STAGE, TICKET_MISMATCH } from "@/lib/triage/filters";

import { count, demoTexts, getCompanyOrThrow, loadDemo, robotix } from "./helpers";

const PERSON = "Astrid Holm";
let counts: PipelineCounts;

beforeEach(() => {
  counts = loadDemo();
});

describe("pipeline", () => {
  it("keeps every raw record as a touchpoint", () => {
    expect(counts.raw_records).toBe(412);
    expect(count("touchpoint")).toBe(412);
    expect(count("touchpoint", (row) => row.channel === "warm_intro")).toBe(25);
  });

  it("makes the Robotix showcase one company with its full history", () => {
    const company = robotix();
    const history = repo.touchpointsOf(company.id);
    expect(company.touchpoint_count).toBe(5);
    expect(history.map((touchpoint) => touchpoint.channel)).toEqual([
      "website_form",
      "cold_email",
      "cold_email",
      "warm_intro",
      "linkedin",
    ]);
    expect(history[0].received_at).toBe("2026-06-09");
    expect(new Set([history[1].recipient, history[2].recipient])).toEqual(new Set(["Astrid Holm", "Jonas Weber"]));
    expect(history[3].introducer_type).toBe("LP");
    expect(company.passed_hard_filters).toBe(true);
  });

  it("gives failing companies a hard-filter pass code", () => {
    const failing = repo.listCompanies().filter((company) => !company.passed_hard_filters);
    expect(failing.length).toBeGreaterThan(0);
    for (const company of failing) {
      expect([OUTSIDE_STAGE, OUTSIDE_GEOGRAPHY, TICKET_MISMATCH]).toContain(company.pass_code);
    }
    expect(repo.listCompanies().filter((company) => company.passed_hard_filters && company.pass_code)).toEqual([]);
  });

  it("never fills an O1 rating and writes no decisions", () => {
    for (const key of [...O1_KEYS, "storytelling_bonus"]) {
      expect(count("company", (row) => row[key] !== null)).toBe(0);
    }
    expect(count("company", (row) => row.score !== 0)).toBe(0);
    expect(count("decision")).toBe(0);
  });

  it("leaves suggested merges waiting for a person", () => {
    expect(counts.suggested_merges).toBeGreaterThan(0);
    expect(repo.countCompanies()).toBe(counts.companies);
    expect(new Set(repo.listMergeSuggestions().map((suggestion) => suggestion.status))).toEqual(new Set(["pending"]));
  });
});

describe("human actions", () => {
  it("moves touchpoints and logs an approved merge", () => {
    const suggestion = repo.listMergeSuggestions()[0];
    const expected =
      repo.touchpointsOf(suggestion.company_id).length + repo.touchpointsOf(suggestion.candidate_id).length;
    approveMerge(suggestion.id, PERSON);
    expect(getCompanyOrThrow(suggestion.company_id).touchpoint_count).toBe(expected);
    expect(repo.getCompany(suggestion.candidate_id)).toBeNull();
    const decisions = repo.listDecisions().filter((decision) => decision.decision === "merge_approved");
    expect(decisions).toHaveLength(1);
    expect(decisions[0].decided_by).toBe(PERSON);
    expect(decisions[0].company_id).toBe(suggestion.company_id);
  });

  it("keeps both companies when a merge is rejected", () => {
    const suggestion = repo.listMergeSuggestions()[0];
    rejectMerge(suggestion.id, PERSON);
    expect(repo.getCompany(suggestion.candidate_id)).not.toBeNull();
    expect(count("decision", (row) => row.decision === "merge_rejected")).toBe(1);
  });

  it("refuses to decide the same merge twice", () => {
    const suggestion = repo.listMergeSuggestions()[0];
    rejectMerge(suggestion.id, PERSON);
    expect(() => approveMerge(suggestion.id, PERSON)).toThrow(ActionRefused);
    expect(count("decision")).toBe(1);
  });

  it("logs advance and pass with who and pass code", () => {
    const open = repo.listCompanies().filter((company) => company.passed_hard_filters && company.status === "open");
    advance(open[0].id, PERSON, "Strong fit");
    passDeal(open[1].id, "market_too_small", PERSON);
    const logged = Object.fromEntries(repo.listDecisions().map((decision) => [decision.decision, decision]));
    expect(logged.advance.decided_by).toBe(PERSON);
    expect(logged.pass.pass_code).toBe("market_too_small");
    expect(logged.pass.decided_at).toBeTruthy();
  });

  it("requires a comment for pass code other", () => {
    expect(() => passDeal(robotix().id, "other", PERSON, " ")).toThrow(ActionRefused);
  });

  it("requires a comment for a rank override, and pins the position", () => {
    expect(() => overrideRank(robotix().id, 1, "", PERSON)).toThrow(ActionRefused);
    overrideRank(robotix().id, 1, "Partner meeting asked to see it first", PERSON);
    const ranked = rankWorklist(repo.listCompaniesWithTouchpoints());
    expect(ranked[0].id).toBe(robotix().id);
    expect(count("decision", (row) => row.decision === "rank_override")).toBe(1);
  });

  it("rescores and logs human O1 ratings", () => {
    expect(robotix().score).toBe(0);
    const ratings = { ...emptyRatings(), team: 5, market: 4, problem_solution_fit: 3 };
    saveRatings(robotix().id, ratings, PERSON);
    const company = robotix();
    expect(company.score).toBe(41); // 20 + 12 + 9
    expect(company.team).toBe(5);
    expect(company.exit_potential).toBeNull();
    const [decision] = repo.listDecisions();
    expect(decision.decision).toBe("rating_changed");
    expect(decision.comment).toMatch(/^O1 41\.0 %: team 5, market opportunity 4, problem–solution fit 3, /);
  });

  it("refuses ratings outside 1–5 (bonus 0–5) and saves nothing", () => {
    const before = robotix();
    expect(() => saveRatings(before.id, { ...emptyRatings(), team: 6 }, PERSON)).toThrow(ActionRefused);
    expect(() => saveRatings(before.id, { ...emptyRatings(), market: 0 }, PERSON)).toThrow(ActionRefused);
    expect(() => saveRatings(before.id, { ...emptyRatings(), storytelling_bonus: 6 }, PERSON)).toThrow(ActionRefused);
    expect(robotix()).toEqual(before);
    expect(count("decision")).toBe(0);
  });

  it("saves nothing when the decision cannot be logged", () => {
    const before = robotix();
    expect(() => saveRatings(before.id, { ...emptyRatings(), team: 3 }, "")).toThrow(ActionRefused);
    expect(robotix()).toEqual(before);
  });

  it("logs an intro marked as replied", () => {
    const intro = repo.touchpointsOf(robotix().id).find((touchpoint) => touchpoint.channel === "warm_intro")!;
    setIntroStatus(intro.id, "replied", PERSON);
    expect(repo.getTouchpoint(intro.id)!.intro_status).toBe("replied");
    expect(count("decision", (row) => row.decision === "intro_replied")).toBe(1);
  });

  it("keeps the audit log through a re-upload", () => {
    advance(robotix().id, PERSON);
    runPipeline(...demoTexts());
    const decision = repo.listDecisions().find((row) => row.decision === "advance")!;
    expect(decision.company_id).toBeNull();
    expect(decision.company_name).toBe("Robotix AI");
  });

  it("leaves the CRM untouched when an upload cannot be read", () => {
    const before = repo.countCompanies();
    expect(() => runPipeline("not,a,deal,flow\n1,2,3,4\n", demoTexts()[1])).toThrow(/missing column/);
    expect(repo.countCompanies()).toBe(before);
    expect(count("touchpoint")).toBe(412);
  });
});
