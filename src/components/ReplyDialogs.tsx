"use client";

/**
 * The three reply dialogs: pass on a deal, reply to a warm intro, thank the introducer.
 * Every draft comes from the one template library and can be edited before it is "sent".
 */

import { useState, type ReactNode } from "react";

import {
  advanceAction,
  passAndReplyAction,
  passDealAction,
  sendIntroducerThanksAction,
  sendIntroReplyAction,
} from "@/app/actions";
import { PASS_CODES, passReplyDraft, type Founder, type ReplyDraft } from "@/lib/triage/drafts";
import { ActionRefused } from "@/lib/triage/errors";
import { label, PASS_CODE_LABELS, SIMULATED_NOTE } from "@/lib/triage/labels";

import { Dialog } from "./Dialog";
import { useAction } from "./useAction";

function DraftEditor({
  draft,
  subject,
  body,
  onSubject,
  onBody,
}: {
  draft: ReplyDraft;
  subject: string;
  body: string;
  onSubject: (value: string) => void;
  onBody: (value: string) => void;
}) {
  return (
    <div className="draft">
      <p className="caption">
        To: <strong>{draft.recipient_name || "–"}</strong> · {draft.recipient_address || "no address on file"}
      </p>
      <label className="field">
        <span>Subject</span>
        <input type="text" value={subject} onChange={(event) => onSubject(event.target.value)} />
      </label>
      <label className="field">
        <span>Message</span>
        <textarea rows={11} value={body} onChange={(event) => onBody(event.target.value)} />
      </label>
    </div>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <div className="alert alert-error" role="alert">
      <span aria-hidden="true">⚠️</span> {error}
    </div>
  ) : null;
}

// ── pass ──────────────────────────────────────────────────────────────────────────

export interface PassDialogData {
  companyId: number;
  companyName: string;
  owner: string;
  founder: Founder;
  passCode: string;
}

function PassForm({ data, onDone }: { data: PassDialogData; onDone: () => void }) {
  const defaultCode = (PASS_CODES as readonly string[]).includes(data.passCode) ? data.passCode : PASS_CODES[0];
  const [passCode, setPassCode] = useState<string>(defaultCode);
  const [comment, setComment] = useState("");
  const { run, pending, error } = useAction();

  let draft: ReplyDraft | null = null;
  let refusal: string | null = null;
  try {
    draft = passReplyDraft({ companyName: data.companyName, owner: data.owner, founder: data.founder }, passCode, comment);
  } catch (caught) {
    if (!(caught instanceof ActionRefused)) throw caught;
    refusal = caught.message;
  }

  return (
    <>
      <p>
        Passing on <strong>{data.companyName}</strong>. The decision and the reply are logged under your name.
      </p>
      <label className="field">
        <span>Reason</span>
        <select value={passCode} onChange={(event) => setPassCode(event.target.value)}>
          {PASS_CODES.map((code) => (
            <option key={code} value={code}>
              {label(PASS_CODE_LABELS, code)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Comment</span>
        <input
          type="text"
          value={comment}
          placeholder="Required when the reason is 'Other'"
          onChange={(event) => setComment(event.target.value)}
        />
      </label>
      {draft ? (
        // A new reason or comment redrafts the reply, discarding edits to the old draft.
        <PassDraft
          key={`${passCode}\u0000${comment}`}
          draft={draft}
          pending={pending}
          onPassAndSend={(subject, body) =>
            run(() => passAndReplyAction(data.companyId, passCode, comment, subject, body), onDone)
          }
          onPassOnly={() => run(() => passDealAction(data.companyId, passCode, comment), onDone)}
        />
      ) : (
        <div className="alert alert-info">{refusal}</div>
      )}
      <ErrorLine error={error} />
    </>
  );
}

function PassDraft({
  draft,
  pending,
  onPassAndSend,
  onPassOnly,
}: {
  draft: ReplyDraft;
  pending: boolean;
  onPassAndSend: (subject: string, body: string) => void;
  onPassOnly: () => void;
}) {
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  return (
    <>
      <p>
        <strong>Reply to the founder</strong> (drafted from the template library, edit freely)
      </p>
      <DraftEditor draft={draft} subject={subject} body={body} onSubject={setSubject} onBody={setBody} />
      <p className="caption">{SIMULATED_NOTE}</p>
      <div className="button-row two">
        <button type="button" className="button primary" disabled={pending} onClick={() => onPassAndSend(subject, body)}>
          ⛔ Pass and send reply
        </button>
        <button type="button" className="button" disabled={pending} onClick={onPassOnly}>
          Pass without a reply
        </button>
      </div>
    </>
  );
}

export function PassButton({
  data,
  children,
  className = "button",
}: {
  data: PassDialogData;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      <Dialog title="Pass on this deal" open={open} onClose={() => setOpen(false)}>
        <PassForm data={data} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

// ── messages to the founder and the introducer ────────────────────────────────────

export interface IntroDialogData {
  introId: number;
  companyName: string;
  introducerName: string;
  draft: ReplyDraft;
}

function SendForm({
  intro,
  lead,
  sendLabel,
  send,
  onDone,
}: {
  intro: IntroDialogData;
  lead: ReactNode;
  sendLabel: string;
  send: (subject: string, body: string) => ReturnType<typeof sendIntroReplyAction>;
  onDone: () => void;
}) {
  const [subject, setSubject] = useState(intro.draft.subject);
  const [body, setBody] = useState(intro.draft.body);
  const { run, pending, error } = useAction();
  return (
    <>
      <p>{lead}</p>
      <DraftEditor draft={intro.draft} subject={subject} body={body} onSubject={setSubject} onBody={setBody} />
      <p className="caption">{SIMULATED_NOTE}</p>
      <button type="button" className="button primary" disabled={pending} onClick={() => run(() => send(subject, body), onDone)}>
        {sendLabel}
      </button>
      <ErrorLine error={error} />
    </>
  );
}

export function IntroReplyButton({
  data,
  children,
  className = "button",
}: {
  data: IntroDialogData;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      <Dialog title="Reply to the founder" open={open} onClose={() => setOpen(false)}>
        <SendForm
          intro={data}
          lead={
            <>
              Warm intro from <strong>{data.introducerName}</strong> for <strong>{data.companyName}</strong>. Sending
              marks the intro as replied.
            </>
          }
          sendLabel="✉️ Send reply"
          send={(subject, body) => sendIntroReplyAction(data.introId, subject, body)}
          onDone={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}

export function IntroducerThanksButton({ data, className = "button" }: { data: IntroDialogData; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        🙏 Thank {data.introducerName}
      </button>
      <Dialog title="Thank the introducer" open={open} onClose={() => setOpen(false)}>
        <SendForm
          intro={data}
          lead={
            <>
              Close the loop with <strong>{data.introducerName}</strong> about <strong>{data.companyName}</strong>.
            </>
          }
          sendLabel="🙏 Send thank-you"
          send={(subject, body) => sendIntroducerThanksAction(data.introId, subject, body)}
          onDone={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}

// ── advance ───────────────────────────────────────────────────────────────────────

/** The advance comment, then Advance beside the pass button (``passButton``). */
export function AdvanceForm({ companyId, passButton }: { companyId: number; passButton: ReactNode }) {
  const [comment, setComment] = useState("");
  const { run, pending, error } = useAction();
  return (
    <>
      <label className="field">
        <span>Comment for advancing (optional)</span>
        <input type="text" value={comment} onChange={(event) => setComment(event.target.value)} />
      </label>
      <div className="button-row two">
        <button
          type="button"
          className="button primary"
          disabled={pending}
          onClick={() => run(() => advanceAction(companyId, comment))}
        >
          ✅ Advance
        </button>
        {passButton}
      </div>
      <ErrorLine error={error} />
    </>
  );
}

export { ErrorLine };
