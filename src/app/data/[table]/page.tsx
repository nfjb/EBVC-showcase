/** Read-only views of the CRM tables, 100 rows a page (what the Lex admin listed in its sidebar). */

import Link from "next/link";
import { notFound } from "next/navigation";

import { getDb } from "@/lib/db/connection";
import { DATA_PAGES, withQuery } from "@/lib/routes";

const TABLES: Record<string, string> = {
  companies: "company",
  touchpoints: "touchpoint",
  "merge-suggestions": "merge_suggestion",
  decisions: "decision",
  outbox: "outbox_message",
};
const PAGE_SIZE = 100;
const LONG = 120;

type Params = Promise<{ table: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DataPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { table: slug } = await params;
  const table = TABLES[slug];
  if (!Object.hasOwn(TABLES, slug)) notFound();
  const search = await searchParams;
  const page = Math.max(1, Number(Array.isArray(search.page) ? search.page[0] : search.page) || 1);
  const db = getDb();
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
  const rows = db
    .prepare(`SELECT * FROM ${table} ORDER BY id LIMIT ? OFFSET ?`)
    .all(PAGE_SIZE, (page - 1) * PAGE_SIZE) as Record<string, unknown>[];
  const columns = (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((column) => column.name);
  const title = DATA_PAGES.find((candidate) => candidate.href === `/data/${slug}`)?.name ?? slug;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const here = `/data/${slug}`;

  return (
    <>
      <h1>{title}</h1>
      <p className="caption">
        {total} row{total === 1 ? "" : "s"} · read-only. Changes are made through the dashboard pages, so each one is
        logged.
      </p>
      {rows.length ? (
        <div className="table-wrap tall">
          <table className="data">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row.id)}>
                  {columns.map((column) => {
                    const text = row[column] === null ? "–" : String(row[column]);
                    return (
                      <td key={column} title={text.length > LONG ? text : undefined}>
                        {text.length > LONG ? `${text.slice(0, LONG)}…` : text}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="alert alert-info">Nothing here yet.</div>
      )}
      {pages > 1 ? (
        <div className="button-row">
          {page > 1 ? (
            <Link className="button" href={withQuery(here, { page: page - 1 })}>
              ‹ Previous
            </Link>
          ) : null}
          <span className="caption" style={{ alignSelf: "center" }}>
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link className="button" href={withQuery(here, { page: page + 1 })}>
              Next ›
            </Link>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
