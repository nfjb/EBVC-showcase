"use client";

/**
 * The priority matrix: every open, filter-passing deal on score % × urgency.
 *
 * Four quadrants (Act now · Plan a deep dive · Reply fast · Park or pass) split at the
 * lines in ``config/weights.yaml`` → ``matrix``. Clicking a bubble opens the deal.
 */

import Link from "next/link";
import type { CSSProperties } from "react";

import { NavigateSelect } from "@/components/CockpitClient";
import { RememberDealList } from "@/components/dealList";
import { HeaderActions } from "@/components/HeaderActions";
import { Caption, DataTable, Notice, NUM, PageHeader } from "@/components/page";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MatrixChart, QUADRANT_COLOURS } from "@/components/MatrixChart";
import { useCrm, useSearchRecord } from "@/components/useCrm";
import { dealHref, withQuery } from "@/lib/routes";
import { cockpitLines } from "@/lib/crm/views";
import { byPriority, byPriorityThenScore, matrixRows, QUADRANT_ORDER } from "@/lib/triage/cockpit";
import { demoToday, loadTriageConfig, teamNames } from "@/lib/triage/config";
import { QUADRANTS, rankByPriority, type QuadrantKey } from "@/lib/triage/urgency";
import { ratedCount } from "@/lib/triage/scoring";
import { cn } from "@/lib/utils";

function one(value: string | undefined): string {
  return value ?? "";
}

const WHOLE_TEAM = "Whole team";
// Tiles laid out like the chart: urgent on top, higher score on the right.
const TILE_LAYOUT: QuadrantKey[] = ["reply_fast", "act_now", "park", "plan"];

export default function MatrixPage() {
  useCrm();
  const params = useSearchRecord();
  const team = teamNames();
  const owner = team.includes(one(params.owner)) ? one(params.owner) : WHOLE_TEAM;
  const selected = (QUADRANT_ORDER as string[]).includes(one(params.q)) ? (one(params.q) as QuadrantKey) : null;
  const ownerParam = owner === WHOLE_TEAM ? null : owner;
  const currentHref = withQuery("/matrix", { owner: ownerParam, q: selected });

  let lines = cockpitLines(demoToday()).filter(
    (line) => line.company.status === "open" && line.company.passed_hard_filters,
  );
  if (owner !== WHOLE_TEAM) lines = lines.filter((line) => line.company.owner === owner);
  const rows = matrixRows(lines);

  return (
    <>
      <PageHeader
        title="Priority matrix"
        eyebrow="Importance Score × Urgency Score"
        description="Every open deal that passed the hard filters, placed by Importance Score (the Fathom rating) and Urgency Score. Deals nobody has rated yet sit at 0 %. Time in queue is not part of either axis."
      />
      <HeaderActions>
        <NavigateSelect
          label="Deals owned by"
          value={owner}
          options={[WHOLE_TEAM, ...team]}
          hrefFor={Object.fromEntries(
            [WHOLE_TEAM, ...team].map((name) => [
              name,
              withQuery("/matrix", { owner: name === WHOLE_TEAM ? null : name, q: selected }),
            ]),
          )}
        />
      </HeaderActions>
      {!rows.length ? (
        <Notice tone="info">No open deals for this owner.</Notice>
      ) : (
        <MatrixBody rows={rows} lines={lines} selected={selected} ownerParam={ownerParam} currentHref={currentHref} />
      )}
    </>
  );
}

function MatrixBody({
  rows,
  lines,
  selected,
  ownerParam,
  currentHref,
}: {
  rows: ReturnType<typeof matrixRows>;
  lines: ReturnType<typeof cockpitLines>;
  selected: QuadrantKey | null;
  ownerParam: string | null;
  currentHref: string;
}) {
  const shown = byPriorityThenScore(selected ? rows.filter((row) => row.quadrant_key === selected) : rows);
  const title = selected ? QUADRANTS[selected][0] : "All deals on the matrix";
  // Label the six highest-priority deals that have a score; unrated ones all sit on the 0 % line.
  const topIds = rankByPriority(lines.filter((line) => ratedCount(line.company)))
    .slice(0, 12)
    .map((line) => line.company.id);
  return (
    <>
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        {TILE_LAYOUT.map((key) => {
          const [name, help] = QUADRANTS[key];
          const count = rows.filter((row) => row.quadrant_key === key).length;
          return (
            <Link
              key={key}
              className="rounded-xl no-underline"
              href={withQuery("/matrix", { owner: ownerParam, q: selected === key ? null : key })}
              aria-current={selected === key ? "true" : undefined}
              aria-label={`Show ${name} (${count})`}
            >
              <Card
                className={cn(
                  "relative h-full gap-1 overflow-hidden py-3 pl-1 transition-shadow hover:shadow-md",
                  selected === key && "ring-2 ring-(--quadrant)",
                )}
                style={{ "--quadrant": QUADRANT_COLOURS[key] } as CSSProperties}
              >
                <span className="absolute inset-y-0 left-0 w-1 bg-(--quadrant)" aria-hidden="true" />
                <CardHeader className="px-4">
                  <CardDescription className="flex items-center justify-between gap-2 font-medium text-foreground">
                    {name}
                    {selected === key ? (
                      <span className="text-xs font-normal text-muted-foreground">Selected · click to clear</span>
                    ) : null}
                  </CardDescription>
                  <CardTitle className="text-3xl font-semibold text-(--quadrant) tabular-nums">{count}</CardTitle>
                  <CardDescription>{help}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>

      <MatrixChart
        rows={rows}
        labelledIds={topIds}
        splits={loadTriageConfig().matrix}
        dealHrefs={Object.fromEntries(rows.map((row) => [row.company_id, dealHref(row.company_id, currentHref)]))}
        priorityOrder={byPriority(rows).map((row) => row.company_id)}
      />

      <RememberDealList title={`Matrix: ${title}`} ids={shown.map((row) => row.company_id)} />
      <div className="mt-8 mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <span className="text-sm text-muted-foreground">{shown.length} deals · highest priority first</span>
      </div>
      <DataTable>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead className={NUM}>Importance Score</TableHead>
            <TableHead className={NUM}>Urgency Score</TableHead>
            <TableHead className={NUM}>Touch­points</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Next action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.slice(0, 30).map((row) => (
            <TableRow key={row.company_id}>
              <TableCell>
                <Link
                  className="font-bold text-foreground no-underline hover:text-primary hover:underline"
                  href={dealHref(row.company_id, currentHref)}
                >
                  {row.Company}
                </Link>
              </TableCell>
              <TableCell className={NUM}>{row["Score %"]}</TableCell>
              <TableCell className={NUM}>{row.Urgency}</TableCell>
              <TableCell className={NUM}>{row.Touchpoints}</TableCell>
              <TableCell>{row.Source}</TableCell>
              <TableCell>{row["Next action"]}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </DataTable>
      {shown.length > 30 ? (
        <Caption>Showing the first 30 of {shown.length}. Pick a quadrant above to narrow the list.</Caption>
      ) : null}
    </>
  );
}
