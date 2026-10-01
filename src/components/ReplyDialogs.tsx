"use client";

/**
 * The three reply dialogs: pass on a deal, reply to a warm intro, thank the introducer.
 * Every draft comes from the one template library and can be edited before it is "sent".
 */

import { Ban, CircleCheck, HandHeart, Mail } from "lucide-react";
import { useId, useState, type ComponentProps, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldDescription, FieldLabel, Field as ShadcnField } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import {
  advanceAction,
  passAndReplyAction,
  passDealAction,
  sendIntroducerThanksAction,
  sendIntroReplyAction,
} from "@/lib/crm/actions";
import { PASS_CODES, passReplyDraft, type Founder, type ReplyDraft } from "@/lib/triage/drafts";
import { ActionRefused } from "@/lib/triage/errors";
import { label, PASS_CODE_LABELS, SIMULATED_NOTE } from "@/lib/triage/labels";

import { Dialog } from "./Dialog";
import { Caption, Notice } from "./page";
import { useAction } from "./useAction";

/** How the button that opens a dialog looks (a shadcn Button's own props). */
export type TriggerProps = Pick<ComponentProps<typeof Button>, "variant" | "size" | "className">;

/** A labelled form field (shadcn Field): the label above its control, an optional hint below. */
export function Field({
  label,
  description,
  children,
  className,
}: {
  label: string;
  description?: string;
  children: (id: string) => ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <ShadcnField className={className ?? "my-3"}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children(id)}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </ShadcnField>
  );
}

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
    <div>
      <Caption>
        To: <strong className="text-foreground">{draft.recipient_name || "–"}</strong> ·{" "}
        {draft.recipient_address || "no address on file"}
      </Caption>
      <Field label="Subject">
        {(id) => <Input id={id} value={subject} onChange={(event) => onSubject(event.target.value)} />}
      </Field>
      <Field label="Message">
        {(id) => (
          <Textarea
            id={id}
            rows={11}
            className="min-h-60 leading-relaxed"
            value={body}
            onChange={(event) => onBody(event.target.value)}
          />
        )}
      </Field>
    </div>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  return error ? <Notice tone="error">{error}</Notice> : null;
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
      <Field label="Reason">
        {(id) => (
          <Select value={passCode} onValueChange={setPassCode}>
            <SelectTrigger id={id} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PASS_CODES.map((code) => (
                <SelectItem key={code} value={code}>
                  {label(PASS_CODE_LABELS, code)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      <Field label="Comment">
        {(id) => (
          <Input
            id={id}
            value={comment}
            placeholder="Required when the reason is 'Other'"
            onChange={(event) => setComment(event.target.value)}
          />
        )}
      </Field>
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
        <Notice tone="info">{refusal}</Notice>
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
      <Caption>{SIMULATED_NOTE}</Caption>
      <div className="my-2.5 grid gap-2.5 sm:grid-cols-2">
        <Button size="lg" disabled={pending} onClick={() => onPassAndSend(subject, body)}>
          <Ban aria-hidden="true" /> Pass and send reply
        </Button>
        <Button size="lg" variant="outline" disabled={pending} onClick={onPassOnly}>
          Pass without a reply
        </Button>
      </div>
    </>
  );
}

export function PassButton({
  data,
  children,
  ...trigger
}: {
  data: PassDialogData;
  children: ReactNode;
} & TriggerProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" {...trigger} onClick={() => setOpen(true)}>
        {children}
      </Button>
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
  sendLabel: ReactNode;
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
      <Caption>{SIMULATED_NOTE}</Caption>
      <Button size="lg" disabled={pending} onClick={() => run(() => send(subject, body), onDone)}>
        {sendLabel}
      </Button>
      <ErrorLine error={error} />
    </>
  );
}

export function IntroReplyButton({
  data,
  children,
  ...trigger
}: {
  data: IntroDialogData;
  children: ReactNode;
} & TriggerProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" {...trigger} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <Dialog title="Reply to the founder" open={open} onClose={() => setOpen(false)}>
        <SendForm
          intro={data}
          lead={
            <>
              Warm intro from <strong>{data.introducerName}</strong> for <strong>{data.companyName}</strong>. Sending
              marks the intro as replied.
            </>
          }
          sendLabel={
            <>
              <Mail aria-hidden="true" /> Send reply
            </>
          }
          send={(subject, body) => sendIntroReplyAction(data.introId, subject, body)}
          onDone={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}

export function IntroducerThanksButton({ data, ...trigger }: { data: IntroDialogData } & TriggerProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" {...trigger} onClick={() => setOpen(true)}>
        <HandHeart aria-hidden="true" /> Thank {data.introducerName}
      </Button>
      <Dialog title="Thank the introducer" open={open} onClose={() => setOpen(false)}>
        <SendForm
          intro={data}
          lead={
            <>
              Close the loop with <strong>{data.introducerName}</strong> about <strong>{data.companyName}</strong>.
            </>
          }
          sendLabel={
            <>
              <HandHeart aria-hidden="true" /> Send thank-you
            </>
          }
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
      <Field label="Comment for advancing (optional)">
        {(id) => <Input id={id} value={comment} onChange={(event) => setComment(event.target.value)} />}
      </Field>
      <div className="my-2.5 grid grid-cols-2 gap-2.5">
        <Button size="lg" disabled={pending} onClick={() => run(() => advanceAction(companyId, comment))}>
          <CircleCheck aria-hidden="true" /> Advance
        </Button>
        {passButton}
      </div>
      <ErrorLine error={error} />
    </>
  );
}

export { ErrorLine };
