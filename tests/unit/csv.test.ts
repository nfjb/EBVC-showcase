/** Reading the uploads like pandas (strings only, BOM and blank lines ignored) and the CSV export. */

import { describe, expect, it } from "vitest";

import { readCsv, toCsv } from "@/lib/triage/csv";

describe("CSV", () => {
  it("keeps every value a string and empty cells empty", () => {
    const rows = readCsv("record_id,round_size_eur,website\nR0001,1250000,\n");
    expect(rows).toEqual([{ record_id: "R0001", round_size_eur: "1250000", website: "" }]);
  });

  it("ignores a byte-order mark and blank lines, and reads quoted commas and newlines", () => {
    const rows = readCsv('﻿name,deck_text\n\n"Robotix, AI","Line one\nline ""two"""\n\n');
    expect(rows).toEqual([{ name: "Robotix, AI", deck_text: 'Line one\nline "two"' }]);
  });

  it("names the missing columns", () => {
    expect(() => readCsv("a,b\n1,2\n", ["record_id", "channel"], "Inbound CSV")).toThrow(
      "Inbound CSV: missing column(s) record_id, channel.",
    );
  });

  it("refuses an empty file", () => {
    expect(() => readCsv("", [], "Signals CSV")).toThrow(/empty/);
  });

  it("round-trips the export, quoting only where needed", () => {
    const columns = ["Rank", "Company", "Open tasks"];
    const rows = [{ Rank: 1, Company: 'Robotix, "AI"', "Open tasks": "Reply to warm intro; Decide this week" }];
    const text = toCsv(columns, rows);
    expect(text).toBe('Rank,Company,Open tasks\n1,"Robotix, ""AI""",Reply to warm intro; Decide this week\n');
    expect(readCsv(text)).toEqual([{ Rank: "1", Company: 'Robotix, "AI"', "Open tasks": "Reply to warm intro; Decide this week" }]);
  });
});
