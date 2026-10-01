/** Sorting the score tables: from the URL, the toggle, and a stable sort. */

import { describe, expect, it } from "vitest";

import { ariaSort, nextSort, readSort, sortByScore } from "@/lib/triage/sorting";

const DEALS = [
  { name: "A", quality: 60, urgency: 30, attention: 18 },
  { name: "B", quality: 44, urgency: 95, attention: 41.8 },
  { name: "C", quality: 60, urgency: 45, attention: 27 },
];

describe("score sorting", () => {
  it("reads the sort from the URL, falling back to the priority order", () => {
    expect(readSort({ sort: "urgency", dir: "asc" })).toEqual({ column: "urgency", direction: "asc" });
    expect(readSort({ sort: "nonsense" })).toEqual({ column: null, direction: "desc" });
    expect(readSort({})).toEqual({ column: null, direction: "desc" });
  });

  it("sorts descending on the first click and flips on the next", () => {
    expect(nextSort({ column: null, direction: "desc" }, "quality")).toEqual({ sort: "quality", dir: "desc" });
    expect(nextSort({ column: "quality", direction: "desc" }, "quality")).toEqual({ sort: "quality", dir: "asc" });
    expect(nextSort({ column: "quality", direction: "asc" }, "quality")).toEqual({ sort: "quality", dir: "desc" });
    // The priority order already is the Attention Score descending, so its first click flips it.
    expect(nextSort({ column: null, direction: "desc" }, "attention")).toEqual({ sort: "attention", dir: "asc" });
  });

  it("keeps the priority order for equal values, and leaves it alone without a sort", () => {
    const by = (column: "quality" | "urgency" | "attention", direction: "asc" | "desc") =>
      sortByScore(DEALS, { column, direction }, (deal) => deal).map((deal) => deal.name);
    expect(by("quality", "desc")).toEqual(["A", "C", "B"]);
    expect(by("urgency", "desc")).toEqual(["B", "C", "A"]);
    expect(by("attention", "asc")).toEqual(["A", "C", "B"]);
    expect(sortByScore(DEALS, { column: null, direction: "desc" }, (deal) => deal)).toBe(DEALS);
    expect(ariaSort({ column: null, direction: "desc" }, "attention")).toBe("descending");
    expect(ariaSort({ column: "urgency", direction: "asc" }, "attention")).toBe("none");
  });
});
