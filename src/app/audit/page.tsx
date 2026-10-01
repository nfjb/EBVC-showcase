"use client";

/** Audit log: every decision, rating, rank override and merge — each one a person's click. */

import { AuditTable } from "@/components/Filtered";
import { ReceiptText } from "lucide-react";

import { EmptyState, PageHeader } from "@/components/page";
import { useCrm } from "@/components/useCrm";
import * as repo from "@/lib/db/repository";
import { formatTimestamp } from "@/lib/triage/dates";
import { label, PASS_CODE_LABELS } from "@/lib/triage/labels";

export default function AuditLogPage() {
  useCrm();
  const decisions = repo.listDecisions();
  return (
    <>
      <PageHeader
        title="Audit log"
        description={
          <>
            Every decision, rating, rank override and merge — each one a person&apos;s click.
          </>
        }
      />
      {!decisions.length ? (
        <EmptyState icon={ReceiptText} title="No decisions logged yet">
          Every advance, pass, rating change, merge and rank override appears here, with who and when.
        </EmptyState>
      ) : (
        <AuditTable
          rows={decisions.map((decision) => ({
            id: decision.id,
            when: formatTimestamp(decision.decided_at),
            who: decision.decided_by,
            company: decision.company_name,
            decision: decision.decision,
            passReason: label(PASS_CODE_LABELS, decision.pass_code),
            comment: decision.comment,
          }))}
        />
      )}
    </>
  );
}
