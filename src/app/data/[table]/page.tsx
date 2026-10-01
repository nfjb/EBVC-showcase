"use client";

/** Read-only views of the CRM tables, 100 rows a page (what the Lex admin listed in its sidebar). */

import Link from "next/link";
import { notFound, useParams } from "next/navigation";

import { useCrm, useSearchRecord } from "@/components/useCrm";
import type { TableName } from "@/lib/db/connection";
import { listTablePage } from "@/lib/db/repository";
import { Caption, DataTable, Notice, PageTitle } from "@/components/page";
import { Button } from "@/components/ui/button";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DATA_PAGES, withQuery } from "@/lib/routes";

const TABLES: Record<string, TableName> = {
  companies: "company",
  touchpoints: "touchpoint",
  "merge-suggestions": "merge_suggestion",
  decisions: "decision",
  outbox: "outbox_message",
};
const PAGE_SIZE = 100;
const LONG = 120;

export default function DataPage() {
  useCrm();
  const { table: slug } = useParams<{ table: string }>();
  const search = useSearchRecord();
  if (!Object.hasOwn(TABLES, slug)) notFound();
  const page = Math.max(1, Number(search.page) || 1);
  const { total, rows, columns } = listTablePage(TABLES[slug], PAGE_SIZE, (page - 1) * PAGE_SIZE);
  const title = DATA_PAGES.find((candidate) => candidate.href === `/data/${slug}`)?.name ?? slug;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const here = `/data/${slug}`;

  return (
    <>
      <PageTitle>{title}</PageTitle>
      <Caption>
        {total} row{total === 1 ? "" : "s"} · read-only. Changes are made through the dashboard pages, so each one is
        logged.
      </Caption>
      {rows.length ? (
        <DataTable tall>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column}>{column}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={String(row.id)}>
                {columns.map((column) => {
                  const text = row[column] === null ? "–" : String(row[column]);
                  return (
                    <TableCell key={column} className="align-top" title={text.length > LONG ? text : undefined}>
                      {text.length > LONG ? `${text.slice(0, LONG)}…` : text}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </DataTable>
      ) : (
        <Notice tone="info">Nothing here yet.</Notice>
      )}
      {pages > 1 ? (
        <div className="my-2.5 flex flex-wrap items-center gap-2.5">
          {page > 1 ? (
            <Button variant="outline" size="lg" asChild>
              <Link href={withQuery(here, { page: page - 1 })}>‹ Previous</Link>
            </Button>
          ) : null}
          <span className="text-sm text-muted-foreground">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Button variant="outline" size="lg" asChild>
              <Link href={withQuery(here, { page: page + 1 })}>Next ›</Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
