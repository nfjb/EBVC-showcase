"use server";

/**
 * Server actions behind every button. Each one runs a single human action (which writes its
 * Decision row), then refreshes every page. A refusal comes back as a message for the form;
 * nothing is saved in that case.
 */

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import * as repo from "@/lib/db/repository";
import { ACTING_COOKIE, actingPerson } from "@/lib/server/person";
import { createUpload, demoFiles } from "@/lib/server/pipeline";
import {
  introducerThanksDraftFor,
  introReplyDraftFor,
  passAndReply,
  passReplyDraftFor,
  sendReply,
} from "@/lib/server/replies";
import {
  advance,
  approveMerge,
  overrideRank,
  passDeal,
  rejectMerge,
  requireCompany,
  saveRatings,
  setIntroStatus,
} from "@/lib/server/triageActions";
import { teamNames } from "@/lib/triage/config";
import type { ReplyDraft } from "@/lib/triage/drafts";
import { ActionRefused } from "@/lib/triage/errors";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

async function run(action: (person: string) => void, success: string | ((person: string) => string)): Promise<ActionResult> {
  const person = await actingPerson();
  try {
    action(person);
  } catch (error) {
    if (error instanceof ActionRefused) return { ok: false, error: `Not saved: ${error.message}` };
    console.error(error);
    return { ok: false, error: "Not saved: something went wrong on the server. Nothing was changed." };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: typeof success === "string" ? success : success(person) };
}

/** The edited subject and body, on the server's own draft (recipients are never taken from the browser). */
function edited(draft: ReplyDraft, subject: string, body: string): ReplyDraft {
  return { ...draft, subject, body };
}

function requireIntro(introId: number) {
  const intro = repo.getTouchpoint(introId);
  if (!intro || intro.channel !== "warm_intro") throw new ActionRefused("This intro no longer exists.");
  return intro;
}

export async function setActingPersonAction(name: string): Promise<void> {
  if (!teamNames().includes(name)) return;
  (await cookies()).set(ACTING_COOKIE, name, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
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
    uploadedBy: await actingPerson(),
  });
  revalidatePath("/", "layout");
  return uploadMessage(result);
}

export async function uploadDemoFilesAction(): Promise<UploadActionResult> {
  const files = demoFiles();
  const result = createUpload({ ...files, uploadedBy: await actingPerson() });
  revalidatePath("/", "layout");
  return uploadMessage(result);
}
