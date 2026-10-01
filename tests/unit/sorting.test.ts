/** Sorting the score tables: from the URL, the toggle, and a stable sort. */

import { describe, expect, it } from "vitest";

import { ariaSort, nextSort, readSort, sortByScore } from "@/lib/triage/sorting";

const DEALS = [
  { name: "A", importance: 60, urgency: 30, total: 18 },
  { name: "B", importance: 44, urgency: 95, total: 41.8 },
  { name: "C", importance: 60, urgency: 45, total: 27 },
];

describe("score sorting", () => {
  it("reads the sort from the URL, falling back to the priority order", () => {
    expect(readSort({ sort: "urgency", dir: "asc" })).toEqual({ column: "urgency", direction: "asc" });
    expect(readSort({ sort: "nonsense" })).toEqual({ column: null, direction: "desc" });
    expect(readSort({})).toEqual({ column: null, direction: "desc" });
  });

  it("sorts descending on the first click and flips on the next", () => {
    expect(nextSort({ column: null, direction: "desc" }, "importance")).toEqual({ sort: "importance", dir: "desc" });
    expect(nextSort({ column: "importance", direction: "desc" }, "importance")).toEqual({ sort: "importance", dir: "asc" });
    expect(nextSort({ column: "importance", direction: "asc" }, "importance")).toEqual({ sort: "importance", dir: "desc" });
    // The priority order already is the Total Score descending, so its first click flips it.
    expect(nextSort({ column: null, direction: "desc" }, "total")).toEqual({ sort: "total", dir: "asc" });
  });

  it("keeps the priority order for equal values, and leaves it alone without a sort", () => {
    const by = (column: "importance" | "urgency" | "total", direction: "asc" | "desc") =>
      sortByScore(DEALS, { column, direction }, (deal) => deal).map((deal) => deal.name);
    expect(by("importance", "desc")).toEqual(["A", "C", "B"]);
    expect(by("urgency", "desc")).toEqual(["B", "C", "A"]);
    expect(by("total", "asc")).toEqual(["A", "C", "B"]);
    expect(sortByScore(DEALS, { column: null, direction: "desc" }, (deal) => deal)).toBe(DEALS);
    expect(ariaSort({ column: null, direction: "desc" }, "total")).toBe("descending");
    expect(ariaSort({ column: "urgency", direction: "asc" }, "total")).toBe("none");
  });
});
