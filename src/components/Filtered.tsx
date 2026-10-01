"use client";

/** The Audit log table and the Outbox list, each with its multi-select filters. */

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { Caption, DataTable } from "./page";

function MultiSelect({
  label,
  placeholder,
  options,
  selected,
  onChange,
  format = (value) => value,
}: {
  label: string;
  placeholder: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  format?: (value: string) => string;
}) {
  const id = useId();
  const summary = selected.length ? selected.map(format).join(", ") : placeholder;
  return (
    <div className="my-2.5 grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            size="lg"
            className="w-full justify-between bg-card font-normal"
            aria-label={`${label}: ${summary}`}
          >
            <span className="truncate">{summary}</span>
            <ChevronDown className="text-muted-foreground" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="max-h-80 w-(--radix-popover-trigger-width) min-w-56 overflow-y-auto p-2">
          <div className="grid gap-1">
            {options.map((option) => {
              const optionId = `${id}-${option}`;
              return (
                <div key={option} className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent">
                  <Checkbox
                    id={optionId}
                    checked={selected.includes(option)}
                    onCheckedChange={(checked) =>
                      onChange(checked ? [...selected, option] : selected.filter((value) => value !== option))
                    }
                  />
                  <Label htmlFor={optionId} className="flex-1 cursor-pointer font-normal">
                    {format(option)}
                  </Label>
                </div>
              );
            })}
          </div>
          {selected.length ? (
            <Button variant="outline" size="sm" className="mt-2" onClick={() => onChange([])}>
              Clear
            </Button>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export interface AuditRow {
  id: number;
  when: string;
  who: string;
  company: string;
  decision: string;
  passReason: string;
  comment: string;
}

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  const [people, setPeople] = useState<string[]>([]);
  const [kinds, setKinds] = useState<string[]>([]);
  const sortedUnique = (values: string[]) => [...new Set(values)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const shown = rows.filter(
    (row) => (!people.length || people.includes(row.who)) && (!kinds.length || kinds.includes(row.decision)),
  );
  return (
    <>
      <div className="grid gap-5 md:grid-cols-2">
        <MultiSelect
          label="Who"
          placeholder="Everyone"
          options={sortedUnique(rows.map((row) => row.who))}
          selected={people}
          onChange={setPeople}
        />
        <MultiSelect
          label="Decision"
          placeholder="All decisions"
          options={sortedUnique(rows.map((row) => row.decision))}
          selected={kinds}
          onChange={setKinds}
        />
      </div>
      <DataTable tall>
        <TableHeader>
          <TableRow>
            <TableHead>When (UTC)</TableHead>
            <TableHead>Who</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Decision</TableHead>
            <TableHead>Pass reason</TableHead>
            <TableHead>Comment</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="align-top">{row.when}</TableCell>
              <TableCell className="align-top">{row.who}</TableCell>
              <TableCell className="align-top">{row.company}</TableCell>
              <TableCell className="align-top">{row.decision}</TableCell>
              <TableCell className="align-top">{row.passReason}</TableCell>
              <TableCell className="align-top whitespace-normal">{row.comment}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </DataTable>
    </>
  );
}

export interface OutboxItem {
  id: number;
  kind: string;
  label: string;
  address: string;
  subject: string;
  body: string;
}

export function OutboxList({ items, kindLabels }: { items: OutboxItem[]; kindLabels: Record<string, string> }) {
  const [kinds, setKinds] = useState<string[]>([]);
  return (
    <>
      <div className="max-w-80">
        <MultiSelect
          label="Type"
          placeholder="All types"
          options={Object.keys(kindLabels)}
          selected={kinds}
          onChange={setKinds}
          format={(kind) => kindLabels[kind] ?? kind}
        />
      </div>
      {items
        .filter((item) => !kinds.length || kinds.includes(item.kind))
        .map((item) => (
          <Collapsible key={item.id} className="group my-2 rounded-lg border bg-card">
            <CollapsibleTrigger className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left font-medium">
              <ChevronDown
                className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90"
                aria-hidden="true"
              />
              {item.label}
            </CollapsibleTrigger>
            <CollapsibleContent className="px-3.5 pb-3.5">
              <Caption>
                To: {item.address} · Subject: {item.subject}
              </Caption>
              <pre className="m-0 rounded-md bg-muted/60 p-3 font-mono text-sm whitespace-pre-wrap">{item.body}</pre>
            </CollapsibleContent>
          </Collapsible>
        ))}
    </>
  );
}
