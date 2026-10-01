/** Audit log: every decision, rating, rank override and merge — each one a person's click. */

import { AuditTable } from "@/components/Filtered";
import * as repo from "@/lib/db/repository";
import { formatTimestamp } from "@/lib/triage/dates";
import { label, PASS_CODE_LABELS } from "@/lib/triage/labels";

export default function AuditLogPage() {
  const decisions = repo.listDecisions();
  return (
    <>
      <h1>Audit log</h1>
      <p className="caption">Every decision, rating, rank override and merge — each one a person&apos;s click.</p>
      {!decisions.length ? (
        <div className="alert alert-info">No decisions logged yet.</div>
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
