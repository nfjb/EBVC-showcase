"use client";

import { Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { uploadDealFlowAction, uploadDemoFilesAction, type UploadActionResult } from "@/lib/crm/actions";

import { Caption, Notice } from "./page";
import { Field } from "./ReplyDialogs";

/** Upload the inbound CSV and the signals CSV; the pipeline runs on submit. */
export function UploadForm() {
  const [result, setResult] = useState<UploadActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  return (
    <Card>
      <CardContent>
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
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Inbound records (CSV)">
              {(id) => <Input id={id} type="file" name="inbound_file" accept=".csv,text/csv" required />}
            </Field>
            <Field label="Signals (CSV)">
              {(id) => <Input id={id} type="file" name="signals_file" accept=".csv,text/csv" required />}
            </Field>
          </div>
          <Caption>
            The upload is the CRM&apos;s source of truth: a run rebuilds every company, touchpoint and suggested merge
            from these two files. The audit log and the Outbox are kept.
          </Caption>
          <div className="my-2.5 flex flex-wrap gap-2.5">
            <Button type="submit" size="lg" disabled={pending}>
              <Upload aria-hidden="true" /> {pending ? "Running the pipeline…" : "Upload and run the pipeline"}
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              disabled={pending}
              onClick={() => startTransition(async () => setResult(await uploadDemoFilesAction()))}
            >
              Use the bundled demo files
            </Button>
          </div>
        </form>
        {result ? <Notice tone={result.ok ? "success" : "error"}>{result.message}</Notice> : null}
      </CardContent>
    </Card>
  );
}
