/**
 * Display labels and formatting shared by every page.
 *
 * Status is always a text label; the icon in front only reinforces it (WCAG: never colour
 * or icon alone).
 */

import { longDate } from "./dates";
import { pyFixed, pyGet } from "./py";
import { ESCALATED, REMINDER_TO_OWNER, type IntroReplyState } from "./workingDays";

export const DECISION_LABELS: Record<string, string> = {
  open: "◻ Open",
  advanced: "✅ Advanced",
  passed: "⛔ Passed",
};
export const INTRO_LABELS: Record<string, string> = {
  open: "◻ Awaiting reply",
  replied: "✅ Replied",
  closed: "▪ Closed",
};
export const CHANNEL_LABELS: Record<string, string> = {
  website_form: "Website form",
  cold_email: "Cold email",
  linkedin: "LinkedIn",
  warm_intro: "Warm intro",
};
export const INTRODUCER_LABELS: Record<string, string> = {
  LP: "LP",
  portfolio_founder: "Portfolio founder",
  angel: "Angel",
};
export const PASS_CODE_LABELS: Record<string, string> = {
  outside_stage: "Outside stage",
  outside_geography: "Outside geography",
  ticket_mismatch: "Ticket mismatch",
  outside_thesis: "Outside thesis",
  market_too_small: "Market too small",
  portfolio_conflict: "Portfolio conflict",
  too_early_revisit_6m: "Too early, revisit in 6 months",
  other: "Other (comment required)",
};
export const MESSAGE_KIND_LABELS: Record<string, string> = {
  intro_reply: "✉️ Intro reply to founder",
  pass: "⛔ Pass reply to founder",
  introducer_thanks: "🙏 Thank-you to introducer",
};

export const SIMULATED_NOTE =
  "Simulated send: the message is stored in the Outbox and the audit log; no email leaves the app.";

export function label(mapping: Record<string, string>, key: string): string {
  return pyGet(mapping, key, key);
}

export function euros(amount: number | null): string {
  return amount === null ? "–" : `EUR ${pyFixed(amount / 1_000_000, 2)}m`;
}

export function rating(value: number | null): string {
  return value === null ? "–" : String(value);
}

/** Plain-language state of one intro, with a leading icon. */
export function introUrgency(introStatus: string, state: IntroReplyState): string {
  if (introStatus !== "open") return pyGet(INTRO_LABELS, introStatus, "");
  if (state.past_deadline) return `⚠️ Overdue since ${longDate(state.deadline)}, escalated to partner`;
  if (state.escalation === ESCALATED) return "⚠️ Due today, escalated to partner";
  if (state.escalation === REMINDER_TO_OWNER) return `⏰ Due ${longDate(state.deadline)}, reminder sent to owner`;
  return `◻ Due ${longDate(state.deadline)}`;
}

/** ``"thesis_fit"`` → ``"Thesis fit"`` (``str.replace("_", " ").capitalize()``). */
export function componentLabel(component: string): string {
  const spaced = component.replaceAll("_", " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}
