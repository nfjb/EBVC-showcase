/**
 * The actions behind every button. Each one runs a single human action (which writes its
 * Decision row); every page re-renders from the store. A refusal comes back as a message for
 * the form; nothing is saved in that case. They run in the browser, against this tab's CRM.
 */

import * as repo from "@/lib/db/repository";
import { actingPerson, setActingMember } from "@/lib/crm/person";
import { createUpload, demoFiles } from "@/lib/crm/pipeline";
import {
  introducerThanksDraftFor,
  introReplyDraftFor,
  passAndReply,
  passReplyDraftFor,
  sendReply,
} from "@/lib/crm/replies";
import {
  advance,
  approveMerge,
  overrideRank,
  passDeal,
  rejectMerge,
  requireCompany,
  saveRatings,
  setIntroStatus,
} from "@/lib/crm/triageActions";
import type { ReplyDraft } from "@/lib/triage/drafts";
import { ActionRefused } from "@/lib/triage/errors";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

async function run(action: (person: string) => void, success: string | ((person: string) => string)): Promise<ActionResult> {
  const person = actingPerson();
  try {
    action(person);
  } catch (error) {
    if (error instanceof ActionRefused) return { ok: false, error: `Not saved: ${error.message}` };
    console.error(error);
    return { ok: false, error: "Not saved: something went wrong. Nothing was changed." };
  }
  return { ok: true, message: typeof success === "string" ? success : success(person) };
}

/** The edited subject and body, on a freshly built draft (recipients are never taken from the form). */
function edited(draft: ReplyDraft, subject: string, body: string): ReplyDraft {
  return { ...draft, subject, body };
}

function requireIntro(introId: number) {
  const intro = repo.getTouchpoint(introId);
  if (!intro || intro.channel !== "warm_intro") throw new ActionRefused("This intro no longer exists.");
  return intro;
}

export function setActingPersonAction(name: string): void {
  setActingMember(name);
}

export async function saveRatingsAction(
  companyId: number,
  thesisFit: number,
  market: number | null,
  team: number | null,
): Promise<ActionResult> {
  return run((person) => saveRatings(companyId, thesisFit, market, team, person), "Ratings saved; score updated.");
}

export async function advanceAction(companyId: number, comment: string): Promise<ActionResult> {
  let name = "";
  return run(
    (person) => {
      name = requireCompany(companyId).name;
      advance(companyId, person, comment);
    },
    () => `Advanced ${name}.`,
  );
}

export async function passDealAction(companyId: number, passCode: string, comment: string): Promise<ActionResult> {
  let name = "";
  return run(
    (person) => {
      name = requireCompany(companyId).name;
      passDeal(companyId, passCode, person, comment);
    },
    () => `Passed on ${name}.`,
  );
}

export async function passAndReplyAction(
  companyId: number,
  passCode: string,
  comment: string,
  subject: string,
  body: string,
): Promise<ActionResult> {
  let name = "";
  return run(
    (person) => {
      const company = requireCompany(companyId);
      name = company.name;
      passAndReply(companyId, passCode, person, comment, edited(passReplyDraftFor(company, passCode, comment), subject, body));
    },
    () => `Passed on ${name} and sent the reply (simulated).`,
  );
}

export async function sendIntroReplyAction(introId: number, subject: string, body: string): Promise<ActionResult> {
  let name = "";
  return run(
    (person) => {
      const intro = requireIntro(introId);
      const company = requireCompany(intro.company_id);
      name = company.name;
      sendReply(company.id, edited(introReplyDraftFor(intro, company), subject, body), person, intro.id);
    },
    () => `Reply sent to the founder of ${name} (simulated).`,
  );
}

export async function sendIntroducerThanksAction(introId: number, subject: string, body: string): Promise<ActionResult> {
  let introducer = "";
  return run(
    (person) => {
      const intro = requireIntro(introId);
      const company = requireCompany(intro.company_id);
      introducer = intro.introducer_name;
      sendReply(company.id, edited(introducerThanksDraftFor(intro, company), subject, body), person);
    },
    () => `Thank-you sent to ${introducer} (simulated).`,
  );
}

export async function overrideRankAction(companyId: number, rank: number | null, comment: string): Promise<ActionResult> {
  return run((person) => overrideRank(companyId, rank, comment, person), "Rank override saved.");
}

export async function approveMergeAction(suggestionId: number): Promise<ActionResult> {
  let name = "";
  return run(
    (person) => {
      const suggestion = repo.getMergeSuggestion(suggestionId);
      name = suggestion ? (repo.getCompany(suggestion.company_id)?.name ?? "") : "";
      approveMerge(suggestionId, person);
    },
    () => `Merged into ${name}.`,
  );
}

export async function rejectMergeAction(suggestionId: number): Promise<ActionResult> {
  return run((person) => rejectMerge(suggestionId, person), "Kept as two companies.");
}

export async function setIntroStatusAction(introId: number, status: "replied" | "closed"): Promise<ActionResult> {
  let name = "";
  return run(
    (person) => {
      const intro = requireIntro(introId);
      name = requireCompany(intro.company_id).name;
      setIntroStatus(introId, status, person);
    },
    () => (status === "replied" ? `Intro for ${name} marked as replied.` : `Intro for ${name} closed.`),
  );
}

export interface UploadActionResult {
  ok: boolean;
  message: string;
}

async function fileInput(form: FormData, field: string): Promise<{ name: string; text: string } | null> {
  const file = form.get(field);
  if (!(file instanceof File) || file.size === 0) return null;
  return { name: file.name, text: await file.text() };
}

function uploadMessage(result: ReturnType<typeof createUpload>): UploadActionResult {
  if (!result.ok) return { ok: false, message: `Not processed: ${result.error}` };
  const { raw_records, companies, suggested_merges, passed_filters } = result.counts;
  return {
    ok: true,
    message:
      `Pipeline run complete: ${raw_records} inbound records → ${companies} companies, ` +
      `${suggested_merges} possible duplicates to confirm, ${passed_filters} passed the hard filters.`,
  };
}

export async function uploadDealFlowAction(form: FormData): Promise<UploadActionResult> {
  const result = createUpload({
    inbound: await fileInput(form, "inbound_file"),
    signals: await fileInput(form, "signals_file"),
    uploadedBy: actingPerson(),
  });
  return uploadMessage(result);
}

export async function uploadDemoFilesAction(): Promise<UploadActionResult> {
  const files = demoFiles();
  const result = createUpload({ ...files, uploadedBy: actingPerson() });
  return uploadMessage(result);
}
