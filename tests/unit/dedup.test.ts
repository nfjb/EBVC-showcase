/** The three match rules of the dedup step (spec §2, §10). */

import { describe, expect, it } from "vitest";

import { domainsConflict, findSuggestedMerges, groupRecords } from "@/lib/triage/dedup";

const THRESHOLD = 0.92;

function record(company_name: string, website = "", founder_email = "", founder_linkedin = "") {
  return { company_name, website, founder_email, founder_linkedin };
}

describe("dedup", () => {
  it("rule 1: the same normalised domain merges", () => {
    const groups = groupRecords([
      record("Robotix AI", "https://robotix.ai"),
      record("Totally Different Name", "www.robotix.ai/"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].record_indices).toEqual([0, 1]);
  });

  it("rule 2: the same founder email merges", () => {
    const records = [
      record("Robotix", "", "Anna@robotix.ai"),
      record("RobotiX GmbH", "", "anna@robotix.ai "),
    ];
    expect(groupRecords(records)).toHaveLength(1);
  });

  it("rule 2: the same LinkedIn profile merges", () => {
    const records = [
      record("Robotix", "", "", "https://www.linkedin.com/in/anna-berg/"),
      record("Robo", "", "", "linkedin.com/in/Anna-Berg"),
    ];
    expect(groupRecords(records)).toHaveLength(1);
  });

  it("chains the rules across records", () => {
    // A shares a domain with B, B shares an email with C → one company.
    const records = [
      record("Robotix", "robotix.ai"),
      record("Robotix", "robotix.ai", "anna@robotix.ai"),
      record("RobotiX GmbH", "", "anna@robotix.ai"),
    ];
    expect(groupRecords(records)).toHaveLength(1);
  });

  it("rule 3: a similar name is only suggested, never merged", () => {
    const groups = groupRecords([record("Robotix AI"), record("Robotics")]);
    expect(groups).toHaveLength(2);
    const suggestions = findSuggestedMerges(groups, THRESHOLD);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].similarity).toBeGreaterThanOrEqual(THRESHOLD);
  });

  it("rule 3: a conflicting domain blocks the suggestion", () => {
    const groups = groupRecords([
      record("Robotix AI", "robotix.ai"),
      record("Robotix", "robotix-industrial.de"),
    ]);
    expect(groups).toHaveLength(2);
    expect(findSuggestedMerges(groups, THRESHOLD)).toEqual([]);
  });

  it("rule 3: dissimilar names are not suggested", () => {
    expect(findSuggestedMerges(groupRecords([record("Robotix"), record("Nordic Grid")]), THRESHOLD)).toEqual([]);
  });

  it("needs a domain on both sides for a domain conflict", () => {
    expect(domainsConflict(new Set(["a.io"]), new Set(["b.io"]))).toBe(true);
    expect(domainsConflict(new Set(["a.io"]), new Set())).toBe(false);
    expect(domainsConflict(new Set(["a.io", "b.io"]), new Set(["b.io"]))).toBe(false);
  });
});
