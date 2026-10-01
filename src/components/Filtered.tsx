"use client";

/** The Audit log table and the Outbox list, each with its multi-select filters. */

import { Check, ChevronsUpDown } from "lucide-react";
import { useId, useState } from "react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Field, FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { cn } from "@/lib/utils";

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
  const toggle = (option: string) =>
    onChange(selected.includes(option) ? selected.filter((value) => value !== option) : [...selected, option]);
  return (
    <Field className="my-3">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            role="combobox"
            className="w-full justify-between font-normal"
            aria-label={`${label}: ${summary}`}
          >
            <span className="truncate">{summary}</span>
            <ChevronsUpDown className="opacity-50" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-56 p-0">
          <Command>
            <CommandInput placeholder={`Filter ${label.toLowerCase()}…`} />
            <CommandList>
              <CommandEmpty>Nothing matches.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem key={option} value={format(option)} onSelect={() => toggle(option)}>
                    <Check className={cn(selected.includes(option) ? "opacity-100" : "opacity-0")} aria-hidden="true" />
                    {format(option)}
                    <span className="sr-only">{selected.includes(option) ? " (selected)" : ""}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              {selected.length ? (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem onSelect={() => onChange([])} className="justify-center">
                      Clear
                    </CommandItem>
                  </CommandGroup>
                </>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </Field>
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
      <Accordion type="multiple" className="rounded-lg border bg-card">
        {items
          .filter((item) => !kinds.length || kinds.includes(item.kind))
          .map((item) => (
            <AccordionItem key={item.id} value={String(item.id)} className="px-4">
              <AccordionTrigger className="text-left">{item.label}</AccordionTrigger>
              <AccordionContent>
                <Caption>
                  To: {item.address} · Subject: {item.subject}
                </Caption>
                <pre className="m-0 rounded-md bg-muted p-3 font-mono text-sm whitespace-pre-wrap">{item.body}</pre>
              </AccordionContent>
            </AccordionItem>
          ))}
      </Accordion>
    </>
  );
}
