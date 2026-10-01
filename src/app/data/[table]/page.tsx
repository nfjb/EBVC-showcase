"use client";

/** Read-only views of the CRM tables, 100 rows a page (what the Lex admin listed in its sidebar). */

import { Database } from "lucide-react";
import { notFound, useParams } from "next/navigation";

import { useCrm, useSearchRecord } from "@/components/useCrm";
import type { TableName } from "@/lib/db/connection";
import { listTablePage } from "@/lib/db/repository";
import { DataTable, EmptyState, PageHeader } from "@/components/page";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
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
      <PageHeader
        title={title}
        description={
          <>
            {total} row{total === 1 ? "" : "s"} · read-only. Changes are made through the dashboard pages, so each one is logged.
          </>
        }
      />
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
        <EmptyState icon={Database} title="Nothing here yet">
          Rows appear here after a deal flow upload or a click on the dashboard pages.
        </EmptyState>
      )}
      {pages > 1 ? (
        <Pagination className="my-4">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href={withQuery(here, { page: Math.max(1, page - 1) })}
                aria-disabled={page === 1}
                className={page === 1 ? "pointer-events-none opacity-50" : undefined}
              />
            </PaginationItem>
            {Array.from({ length: pages }, (_, index) => index + 1).map((number) => (
              <PaginationItem key={number}>
                <PaginationLink href={withQuery(here, { page: number })} isActive={number === page}>
                  {number}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href={withQuery(here, { page: Math.min(pages, page + 1) })}
                aria-disabled={page === pages}
                className={page === pages ? "pointer-events-none opacity-50" : undefined}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </>
  );
}
