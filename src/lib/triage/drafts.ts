/**
 * Reply drafts from one template library (spec §5, §7).
 *
 * Every draft is two or three sentences, names the reason, and is signed by the person the
 * founder originally contacted, so the tone is consistent across partners. These functions
 * are pure: the server uses them to send, and the dialogs use them to redraft live as the
 * person changes the pass reason.
 */

import { addWorkingDays } from "./workingDays";
import { fullDate, type IsoDate } from "./dates";
import { ActionRefused } from "./errors";
import { pyGet, pySplit, pyStrip } from "./py";

export const PASS_CODES = [
  "outside_stage",
  "outside_geography",
  "ticket_mismatch",
  "outside_thesis",
  "market_too_small",
  "portfolio_conflict",
  "too_early_revisit_6m",
  "other",
] as const;

export const PASS_REASONS: Record<string, string> = {
  outside_stage: "we only lead Pre-Seed and Seed rounds, so {company} is at a later stage than we invest",
  outside_geography: "Fund II invests only in companies based in the Nordics and DACH",
  ticket_mismatch: "the round size does not fit our ticket of EUR 0.5–2m",
  outside_thesis: "it sits outside the areas our thesis focuses on",
  market_too_small: "we are not yet convinced the market is large enough for a venture outcome",
  portfolio_conflict: "it would overlap with a company already in our portfolio",
  too_early_revisit_6m: "it is a little early for us, and we would love to hear from you again in six months",
  other: "{comment}",
};

export interface ReplyDraft {
  kind: "intro_reply" | "pass" | "introducer_thanks" | string;
  recipient_name: string;
  recipient_address: string;
  subject: string;
  body: string;
}

/** The founder's name and the most recent address on file, from the company's touchpoints. */
export interface Founder {
  name: string;
  address: string;
}

export function firstName(fullName: string): string {
  return pySplit(fullName || "there")[0] ?? "there";
}

/** ``_founder``: newest touchpoint first, the first name and the first email or LinkedIn. */
export function founderFromTouchpoints(
  touchpoints: { id: number; received_at: IsoDate; founder_name: string; founder_email: string; founder_linkedin: string }[],
): Founder {
  const newestFirst = [...touchpoints].sort((a, b) =>
    a.received_at === b.received_at ? a.id - b.id : a.received_at < b.received_at ? 1 : -1,
  );
  const name = newestFirst.find((touchpoint) => touchpoint.founder_name)?.founder_name ?? "";
  const withAddress = newestFirst.find((touchpoint) => touchpoint.founder_email || touchpoint.founder_linkedin);
  const address = withAddress ? withAddress.founder_email || withAddress.founder_linkedin : "";
  return { name, address };
}

/** Acknowledge a warm intro to the founder, whatever the fit (problem 3). */
export function introReplyDraft(input: {
  companyName: string;
  founder: Founder;
  introducerName: string;
  /** The person the intro was sent to; they sign the reply. */
  introRecipient: string;
  today: IsoDate;
}): ReplyDraft {
  const replyBy = addWorkingDays(input.today, 5);
  return {
    kind: "intro_reply",
    recipient_name: input.founder.name,
    recipient_address: input.founder.address,
    subject: `${input.companyName} × Skarv Ventures`,
    body:
      `Hi ${firstName(input.founder.name)},\n\n` +
      `Thank you for reaching out, and thanks to ${input.introducerName} for the introduction. ` +
      `We are reviewing ${input.companyName} now and will come back to you by ` +
      `${fullDate(replyBy)} with a clear answer.\n\n` +
      `Best regards,\n${input.introRecipient}\nSkarv Ventures`,
  };
}

/** A short, personal pass with the named reason, signed by the person first contacted. */
export function passReplyDraft(
  input: { companyName: string; owner: string; founder: Founder },
  passCode: string,
  comment = "",
): ReplyDraft {
  if (!Object.hasOwn(PASS_REASONS, passCode)) throw new ActionRefused(`Unknown pass code: ${passCode}.`);
  if (passCode === "other" && !pyStrip(comment)) {
    throw new ActionRefused("Pass code 'other' needs a comment to use as the reason.");
  }
  const reason = PASS_REASONS[passCode].replace(/\{(company|comment)\}/g, (_, field: string) =>
    field === "company" ? input.companyName : pyStrip(comment),
  );
  return {
    kind: "pass",
    recipient_name: input.founder.name,
    recipient_address: input.founder.address,
    subject: `${input.companyName} × Skarv Ventures`,
    body:
      `Hi ${firstName(input.founder.name)},\n\n` +
      `Thank you for sharing ${input.companyName} with us — we enjoyed learning about it. ` +
      `We have decided not to invest this time, because ${reason}. ` +
      "We wish you the very best with the round and would be glad to stay in touch.\n\n" +
      `Best regards,\n${input.owner}\nSkarv Ventures`,
  };
}

const THANKS_OUTCOMES: Record<string, string> = {
  advanced: "we are taking it forward to the next stage",
  passed: "we have decided not to invest this time, and have told the founder personally",
};

/** Close the loop with the LP, portfolio founder or angel who made the intro. */
export function introducerThanksDraft(input: {
  companyName: string;
  companyStatus: string;
  introducerName: string;
  introRecipient: string;
}): ReplyDraft {
  const outcome = pyGet(
    THANKS_OUTCOMES,
    input.companyStatus,
    "we have been in touch with the founder and are reviewing it now",
  );
  return {
    kind: "introducer_thanks",
    recipient_name: input.introducerName,
    recipient_address: "",
    subject: `Thank you for introducing ${input.companyName}`,
    body:
      `Hi ${firstName(input.introducerName)},\n\n` +
      `Thank you for introducing us to ${input.companyName}. A quick update: ${outcome}. ` +
      "We really appreciate you thinking of us.\n\n" +
      `Best regards,\n${input.introRecipient}\nSkarv Ventures`,
  };
}
