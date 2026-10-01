"use client";

import { ChevronDown, Download, Printer } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toCsv } from "@/lib/triage/csv";
import { cn } from "@/lib/utils";

import { DataTable, NUM } from "./page";
import { IntroReplyButton, PassButton, type IntroDialogData, type PassDialogData } from "./ReplyDialogs";

export type PillAction =
  | { kind: "intro"; data: IntroDialogData }
  | { kind: "pass_draft"; data: PassDialogData }
  | { kind: "link"; href: string };

/** The next-action pill in "My view": it does the next step right there. */
export function NextActionPill({ label, hot, action }: { label: string; hot: boolean; action: PillAction }) {
  // Red marks what is urgent; ink is everything else. The words say which step it is.
  const look = { variant: hot ? "default" : "secondary", size: "sm", className: cn("rounded-full px-3.5 font-semibold", !hot && "hover:bg-secondary/85") } as const;
  if (action.kind === "intro") {
    return (
      <IntroReplyButton data={action.data} {...look}>
        {label}
      </IntroReplyButton>
    );
  }
  if (action.kind === "pass_draft") {
    return (
      <PassButton data={action.data} {...look}>
        {label}
      </PassButton>
    );
  }
  return (
    <Button {...look} asChild>
      <Link href={action.href}>{label}</Link>
    </Button>
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
  const id = `navigate-${label.replaceAll(" ", "-").toLowerCase()}`;
  // Compact, for the top bar: the label beside a small select.
  return (
    <div className="flex items-center gap-2 print:hidden">
      <Label htmlFor={id} className="hidden text-sm font-normal whitespace-nowrap text-muted-foreground sm:block">
        {label}
      </Label>
      <Select value={value} onValueChange={(next) => router.push(hrefFor[next])}>
        <SelectTrigger id={id} size="sm" className="w-44" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export interface ExportRow {
  Rank: number;
  Company: string;
  Website: string;
  Description: string;
  Stage: string;
  Country: string;
  "Quality Score": number;
  "Urgency Score": number;
  "Total Score": number;
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
  "Quality Score",
  "Urgency Score",
  "Total Score",
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
    <Collapsible className="mt-4">
      <ButtonGroup className="print:hidden">
        <Button variant="outline" onClick={download} disabled={!rows.length}>
          <Download aria-hidden="true" /> Export to CSV
        </Button>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="group/print">
            <ChevronDown className="transition-transform group-data-[state=open]/print:rotate-180" aria-hidden="true" />
            Print view for the Monday meeting
          </Button>
        </CollapsibleTrigger>
        <Button variant="outline" onClick={() => window.print()} disabled={!rows.length}>
          <Printer aria-hidden="true" /> Print
        </Button>
      </ButtonGroup>
      {/* Always mounted, so printing shows the table even when it is collapsed on screen. */}
      <CollapsibleContent forceMount className="mt-3 data-[state=closed]:hidden print:!block">
        {rows.length ? (
          <DataTable>
            <TableHeader>
              <TableRow>
                {printColumns.map((column) => (
                  <TableHead key={column} className={cn(typeof rows[0][column] === "number" && NUM)}>
                    {column}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.Rank}>
                  {printColumns.map((column) => (
                    <TableCell
                      key={column}
                      className={cn("whitespace-normal align-top", typeof row[column] === "number" && NUM)}
                    >
                      {row[column]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}
