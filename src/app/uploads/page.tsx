"use client";

/** Deal flow uploads: upload the inbound CSV and the signals CSV, and run the triage pipeline. */

import { CircleCheck, TriangleAlert } from "lucide-react";

import { Caption, DataTable, NUM, PageHeader } from "@/components/page";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AgentRateButton } from "@/components/AgentRateButton";
import { UploadForm } from "@/components/UploadForm";
import { useCrm } from "@/components/useCrm";
import * as repo from "@/lib/db/repository";
import { formatTimestamp } from "@/lib/triage/dates";

export default function UploadsPage() {
  useCrm();
  const uploads = repo.listUploads();
  return (
    <>
      <PageHeader
        title="Deal flow uploads"
        description={
          <>
            Merge records into companies and touchpoints, queue fuzzy matches as suggested merges, apply the hard filters and score every company.
          </>
        }
      />
      <UploadForm />
      <AgentRateButton />
      <h2 className="mt-7 mb-2 text-xl font-bold">Previous runs</h2>
      {!uploads.length ? (
        <Caption>No uploads yet.</Caption>
      ) : (
        <DataTable>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>By</TableHead>
              <TableHead>Inbound file</TableHead>
              <TableHead>Signals file</TableHead>
              <TableHead className={NUM}>Raw records</TableHead>
              <TableHead className={NUM}>Companies</TableHead>
              <TableHead className={NUM}>Suggested merges</TableHead>
              <TableHead className={NUM}>Passed filters</TableHead>
              <TableHead>Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {uploads.map((upload) => (
              <TableRow key={upload.id}>
                <TableCell>{formatTimestamp(upload.created_at)}</TableCell>
                <TableCell>{upload.uploaded_by}</TableCell>
                <TableCell>{upload.inbound_file}</TableCell>
                <TableCell>{upload.signals_file}</TableCell>
                <TableCell className={NUM}>{upload.raw_record_count}</TableCell>
                <TableCell className={NUM}>{upload.company_count}</TableCell>
                <TableCell className={NUM}>{upload.suggested_merge_count}</TableCell>
                <TableCell className={NUM}>{upload.passed_filter_count}</TableCell>
                <TableCell className="whitespace-normal">
                  {upload.status === "success" ? (
                    <span className="inline-flex items-center gap-1.5 text-success-foreground">
                      <CircleCheck className="size-4" aria-hidden="true" /> Processed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-error-foreground">
                      <TriangleAlert className="size-4" aria-hidden="true" /> Failed: {upload.error}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </DataTable>
      )}
    </>
  );
}
