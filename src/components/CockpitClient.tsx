"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { toCsv } from "@/lib/triage/csv";

import { IntroReplyButton, PassButton, type IntroDialogData, type PassDialogData } from "./ReplyDialogs";

export type PillAction =
  | { kind: "intro"; data: IntroDialogData }
  | { kind: "pass_draft"; data: PassDialogData }
  | { kind: "link"; href: string };

/** The next-action pill in "My view": it does the next step right there. */
export function NextActionPill({ label, hot, action }: { label: string; hot: boolean; action: PillAction }) {
  const className = hot ? "pill hot" : "pill";
  if (action.kind === "intro") {
    return (
      <IntroReplyButton data={action.data} className={className}>
        {label}
      </IntroReplyButton>
    );
  }
  if (action.kind === "pass_draft") {
    return (
      <PassButton data={action.data} className={className}>
        {label}
      </PassButton>
    );
  }
  return (
    <Link href={action.href} className={className}>
      {label}
    </Link>
  );
}

/** A select that navigates (owner filters). */
export function NavigateSelect({
  label,
  value,
  options,
  hrefFor,
}: {
  label: string;
  value: string;
  options: string[];
  hrefFor: Record<string, string>;
}) {
  const router = useRouter();
  return (
    <label className="field inline no-print">
      <span>{label}</span>
      <select value={value} onChange={(event) => router.push(hrefFor[event.target.value])}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export interface ExportRow {
  Rank: number;
  Company: string;
  Website: string;
  Description: string;
  Stage: string;
  Country: string;
  "Score %": number;
  Urgency: number;
  "Open tasks": string;
  "Next action": string;
  "Days in queue": number;
  Owner: string;
}

const EXPORT_COLUMNS: (keyof ExportRow)[] = [
  "Rank",
  "Company",
  "Website",
  "Description",
  "Stage",
  "Country",
  "Score %",
  "Urgency",
  "Open tasks",
  "Next action",
  "Days in queue",
  "Owner",
];

/** Export the list to CSV, and a print view for the Monday meeting. */
export function ExportControls({ fileName, rows }: { fileName: string; rows: ExportRow[] }) {
  function download() {
    const blob = new Blob([toCsv(EXPORT_COLUMNS, rows as unknown as Record<string, unknown>[])], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  const printColumns = EXPORT_COLUMNS.filter((column) => column !== "Website");
  return (
    <div className="export">
      <div className="button-row no-print">
        <button type="button" className="button" onClick={download} disabled={!rows.length}>
          ⬇ Export to CSV
        </button>
      </div>
      <details className="expander print-view">
        <summary>Print view for the Monday meeting</summary>
        <div className="expander-body">
          <p className="caption no-print">Print with Ctrl+P.</p>
          {rows.length ? (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    {printColumns.map((column) => (
                      <th key={column} className={typeof rows[0][column] === "number" ? "num" : undefined}>
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.Rank}>
                      {printColumns.map((column) => (
                        <td key={column} className={typeof row[column] === "number" ? "num" : undefined}>
                          {row[column]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </details>
    </div>
  );
}
