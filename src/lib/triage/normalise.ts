/** Normalisation of domains, emails, LinkedIn URLs and company names for matching. */

import { PY_SPACE_CLASS, PY_WORD_CLASS, pyRstripChars, pySplit, pyStrip, pyStripChars } from "./py";

export const LEGAL_SUFFIXES = new Set([
  "gmbh",
  "ab",
  "aps",
  "as",
  "oy",
  "ag",
  "ltd",
  "limited",
  "inc",
  "sa",
  "bv",
  "oyj",
  "asa",
]);
export const NOISE_TOKENS = new Set(["labs", "lab", "ai", "technologies", "technology", "tech", "hq", "the"]);

const SCHEME = /^[a-z]+:\/\//;
const PUNCTUATION = new RegExp(`[^${PY_WORD_CLASS}${PY_SPACE_CLASS}]`, "gu");

/** ``https://www.Robotix.ai/about/`` → ``robotix.ai``. */
export function normaliseDomain(website: string | null | undefined): string {
  if (!website) return "";
  let domain = pyStrip(website).toLowerCase();
  domain = domain.replace(SCHEME, "");
  domain = domain.split("/")[0].split("?")[0].split("#")[0];
  domain = domain.split(":")[0];
  if (domain.startsWith("www.")) domain = domain.slice("www.".length);
  return pyStripChars(domain, ".");
}

export function normaliseEmail(email: string | null | undefined): string {
  return pyStrip(email ?? "").toLowerCase();
}

/** ``https://www.linkedin.com/in/Anna-Berg/?utm=x`` → ``linkedin.com/in/anna-berg``. */
export function normaliseLinkedin(url: string | null | undefined): string {
  if (!url) return "";
  let linkedin = pyStrip(url).toLowerCase();
  linkedin = linkedin.replace(SCHEME, "");
  linkedin = linkedin.split("?")[0].split("#")[0];
  if (linkedin.startsWith("www.")) linkedin = linkedin.slice("www.".length);
  return pyRstripChars(linkedin, "/");
}

/** ``RobotiX GmbH`` / ``Robotix AI`` / ``Robotix`` → ``robotix``. */
export function normaliseCompanyName(name: string | null | undefined): string {
  if (!name) return "";
  const lowered = name.toLowerCase().replace(PUNCTUATION, " ");
  const tokens = pySplit(lowered).filter(
    (token) => !LEGAL_SUFFIXES.has(token) && !NOISE_TOKENS.has(token),
  );
  // A name made only of noise ("AI Labs") keeps its words rather than becoming empty.
  return tokens.join(" ") || pySplit(lowered).join(" ");
}
