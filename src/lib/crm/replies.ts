/**
 * Reply drafts for stored deals, and the simulated "send" (spec §5, §7).
 *
 * Sending is simulated: it stores an OutboxMessage and a Decision row, and delivers nothing.
 */

import { atomic } from "@/lib/db/connection";
import * as repo from "@/lib/db/repository";
import { demoToday } from "@/lib/triage/config";
import {
  founderFromTouchpoints,
  introducerThanksDraft,
  introReplyDraft,
  passReplyDraft,
  type ReplyDraft,
} from "@/lib/triage/drafts";
import { ActionRefused } from "@/lib/triage/errors";
import { pyStrip } from "@/lib/triage/py";
import type { Company, Touchpoint } from "@/lib/triage/types";

import { logDecision, passDeal, requireCompany } from "./triageActions";

export function founderOf(companyId: number) {
  return founderFromTouchpoints(repo.touchpointsOf(companyId));
}

export function introReplyDraftFor(intro: Touchpoint, company: Company): ReplyDraft {
  return introReplyDraft({
    companyName: company.name,
    founder: founderOf(company.id),
    introducerName: intro.introducer_name,
    introRecipient: intro.recipient,
    today: demoToday(),
  });
}

export function passReplyDraftFor(company: Company, passCode: string, comment = ""): ReplyDraft {
  return passReplyDraft({ companyName: company.name, owner: company.owner, founder: founderOf(company.id) }, passCode, comment);
}

export function introducerThanksDraftFor(intro: Touchpoint, company: Company): ReplyDraft {
  return introducerThanksDraft({
    companyName: company.name,
    companyStatus: company.status,
    introducerName: intro.introducer_name,
    introRecipient: intro.recipient,
  });
}

/**
 * Simulated send: store the message and log the click. Nothing is delivered.
 * Sending an intro reply also marks the intro as replied.
 */
export function sendReply(companyId: number, draft: ReplyDraft, sentBy: string, introId: number | null = null): number {
  if (!pyStrip(draft.body) || !pyStrip(draft.subject)) throw new ActionRefused("A reply needs a subject and a message.");
  if (!sentBy) throw new ActionRefused("A reply needs the name of the person sending it.");
  return atomic(() => {
    const company = requireCompany(companyId);
    const messageId = repo.insertOutboxMessage({
      company_id: company.id,
      company_name: company.name,
      kind: draft.kind,
      recipient_name: draft.recipient_name,
      recipient_address: draft.recipient_address,
      subject: draft.subject,
      body: draft.body,
      sent_by: sentBy,
      sent_at: new Date().toISOString(),
    });
    logDecision(
      company,
      "message_sent",
      sentBy,
      "",
      `${draft.kind} to ${draft.recipient_name || "recipient"} (simulated send)`,
    );
    if (introId !== null && draft.kind === "intro_reply") {
      repo.updateTouchpoint(introId, { intro_status: "replied", intro_replied_at: demoToday() });
    }
    return messageId;
  });
}

/** Pass on the deal and send the (edited) pass reply in one click — both logged. */
export function passAndReply(companyId: number, passCode: string, sentBy: string, comment: string, draft: ReplyDraft): void {
  atomic(() => {
    passDeal(companyId, passCode, sentBy, comment);
    sendReply(companyId, draft, sentBy);
  });
}
