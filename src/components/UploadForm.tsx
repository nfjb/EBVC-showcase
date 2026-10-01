"use client";

import { useRef, useState, useTransition } from "react";

import { uploadDealFlowAction, uploadDemoFilesAction, type UploadActionResult } from "@/app/actions";

/** Upload the inbound CSV and the signals CSV; the pipeline runs on submit. */
export function UploadForm() {
  const [result, setResult] = useState<UploadActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  return (
    <div className="card">
      <form
        ref={form}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(async () => {
            const outcome = await uploadDealFlowAction(data);
            setResult(outcome);
            if (outcome.ok) form.current?.reset();
          });
        }}
      >
        <div className="grid-2">
          <label className="field">
            <span>Inbound records (CSV)</span>
            <input type="file" name="inbound_file" accept=".csv,text/csv" required />
          </label>
          <label className="field">
            <span>Signals (CSV)</span>
            <input type="file" name="signals_file" accept=".csv,text/csv" required />
          </label>
        </div>
        <p className="caption">
          The upload is the CRM&apos;s source of truth: a run rebuilds every company, touchpoint and suggested merge
          from these two files. The audit log and the Outbox are kept.
        </p>
        <div className="button-row">
          <button type="submit" className="button primary" disabled={pending}>
            {pending ? "Running the pipeline…" : "Upload and run the pipeline"}
          </button>
          <button
            type="button"
            className="button"
            disabled={pending}
            onClick={() => startTransition(async () => setResult(await uploadDemoFilesAction()))}
          >
            Use the bundled demo files
          </button>
        </div>
      </form>
      {result ? (
        <div className={result.ok ? "alert alert-success" : "alert alert-error"} role={result.ok ? "status" : "alert"}>
          {result.ok ? "✅ " : "⚠️ "}
          {result.message}
        </div>
      ) : null}
    </div>
  );
}
