/**
 * The Python semantics the rules were written against (rounding ties, whitespace), which
 * JavaScript's built-ins do not share. Priority is ``round(score % × urgency / 100, 1)``, so
 * a tie such as 5 × 45 / 100 = 2.25 must round to 2.2, as Python does, not 2.3.
 */

import { describe, expect, it } from "vitest";

import { pyFixed, pyRound, pySplit, pyStrip, pyToInt } from "@/lib/triage/py";

describe("Python semantics", () => {
  it.each([
    [0.5, 0, 0],
    [1.5, 0, 2],
    [2.5, 0, 2],
    [2.25, 1, 2.2],
    [0.125, 2, 0.12],
    [2.675, 2, 2.67],
    [12.15, 1, 12.2],
    [0.75, 1, 0.8],
  ])("round(%d, %d) == %d", (value, digits, expected) => {
    expect(pyRound(value, digits)).toBe(expected);
  });

  it("formats with round-half-even", () => {
    expect(pyFixed(2.25, 1)).toBe("2.2");
    expect(pyFixed(3.5, 0)).toBe("4");
    expect(pyFixed(0.92, 2)).toBe("0.92");
  });

  it("strips and splits on Python whitespace only", () => {
    expect(pyStrip("  robotix \t\n")).toBe("robotix");
    expect(pyStrip("﻿robotix")).toBe("﻿robotix");
    expect(pySplit("  nordic   grid ")).toEqual(["nordic", "grid"]);
    expect(pySplit("   ")).toEqual([]);
  });

  it("reads integers like int(float(value))", () => {
    expect(pyToInt("3500000")).toBe(3_500_000);
    expect(pyToInt("1.25e6")).toBe(1_250_000);
    expect(pyToInt(" 12.9 ")).toBe(12);
    expect(pyToInt("")).toBeNull();
    expect(pyToInt("1,250,000")).toBeNull();
    expect(pyToInt("0x10")).toBeNull();
  });
});
