/** Domain, email, LinkedIn and company-name normalisation (spec §2, §10). */

import { describe, expect, it } from "vitest";

import {
  normaliseCompanyName,
  normaliseDomain,
  normaliseEmail,
  normaliseLinkedin,
} from "@/lib/triage/normalise";

describe("normalisation", () => {
  it.each([
    "robotix.ai",
    "https://robotix.ai",
    "http://www.robotix.ai/",
    "https://WWW.Robotix.AI/about/team?ref=x",
    "www.robotix.ai//",
    " robotix.ai:443/ ",
  ])("domain variant %j normalises to the same domain", (website) => {
    expect(normaliseDomain(website)).toBe("robotix.ai");
  });

  it("keeps an empty domain empty", () => {
    expect(normaliseDomain("")).toBe("");
    expect(normaliseDomain(null)).toBe("");
  });

  it("lowercases and trims an email", () => {
    expect(normaliseEmail("  Anna.Berg@Robotix.AI ")).toBe("anna.berg@robotix.ai");
  });

  it.each([
    "https://www.linkedin.com/in/anna-berg/",
    "linkedin.com/in/Anna-Berg",
    "http://linkedin.com/in/anna-berg?utm_source=share",
  ])("LinkedIn variant %j normalises to the same profile", (url) => {
    expect(normaliseLinkedin(url)).toBe("linkedin.com/in/anna-berg");
  });

  it.each(["Robotix AI", "Robotix", "RobotiX GmbH", "Robotix Labs AB", "Robotix, Ltd."])(
    "company name %j strips legal suffixes and noise tokens",
    (name) => {
      expect(normaliseCompanyName(name)).toBe("robotix");
    },
  );

  it("keeps meaningful words in a company name", () => {
    expect(normaliseCompanyName("Nordic Grid Oy")).toBe("nordic grid");
  });

  it("does not empty a name made only of noise", () => {
    expect(normaliseCompanyName("AI Labs")).toBe("ai labs");
  });
});
