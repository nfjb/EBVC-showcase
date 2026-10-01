"use client";

/**
 * Outbox: every reply sent from the app. Sending is simulated: messages are stored here and
 * in the audit log, and never delivered.
 */

import { OutboxList } from "@/components/Filtered";
import { Send } from "lucide-react";

import { EmptyState, PageHeader } from "@/components/page";
import { useCrm } from "@/components/useCrm";
import * as repo from "@/lib/db/repository";
import { formatShortTimestamp } from "@/lib/triage/dates";
import { label, MESSAGE_KIND_LABELS } from "@/lib/triage/labels";

export default function OutboxPage() {
  useCrm();
  const messages = repo.listOutboxMessages();
  return (
    <>
      <PageHeader
        title="Outbox"
        description={
          <>
            Every reply sent from the app. Sending is simulated: messages are stored here and in the audit log, and never delivered.
          </>
        }
      />
      {!messages.length ? (
        <EmptyState icon={Send} title="Nothing sent yet">
          Reply to an intro in the Intro tracker, or pass on a deal.
        </EmptyState>
      ) : (
        <OutboxList
          kindLabels={MESSAGE_KIND_LABELS}
          items={messages.map((message) => ({
            id: message.id,
            kind: message.kind,
            label:
              `${label(MESSAGE_KIND_LABELS, message.kind)} · ${message.company_name} → ` +
              `${message.recipient_name || "–"} · ${formatShortTimestamp(message.sent_at)} UTC by ${message.sent_by}`,
            address: message.recipient_address || "no address on file",
            subject: message.subject,
            body: message.body,
          }))}
        />
      )}
    </>
  );
}
