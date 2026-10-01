"use client";

/**
 * The priority matrix: every open, filter-passing deal on score % × urgency.
 *
 * Four quadrants (Act now · Plan a deep dive · Reply fast · Park or pass) split at the
 * lines in ``config/weights.yaml`` → ``matrix``. Clicking a bubble opens the deal.
 */

import Link from "next/link";

import { NavigateSelect } from "@/components/CockpitClient";
import { RememberDealList } from "@/components/dealList";
import { Caption, DataTable, Display, Eyebrow, Lede, Notice, NUM } from "@/components/page";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MatrixChart } from "@/components/MatrixChart";
import { useCrm, useSearchRecord } from "@/components/useCrm";
import { dealHref, withQuery } from "@/lib/routes";
import { cockpitLines } from "@/lib/crm/views";
import { byPriority, byPriorityThenScore, matrixRows, QUADRANT_ORDER } from "@/lib/triage/cockpit";
import { demoToday, loadTriageConfig, teamNames } from "@/lib/triage/config";
import { QUADRANTS, rankByPriority, type QuadrantKey } from "@/lib/triage/urgency";

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
      <Eyebrow>Score × urgency</Eyebrow>
      <Display>Priority matrix</Display>
      <Lede>
        Every open deal that passed the hard filters, placed by fit and urgency. Time in queue is not part of either
        axis.
      </Lede>
      <NavigateSelect
        label="Deals owned by"
        value={owner}
        options={[WHOLE_TEAM, ...team]}
        hrefFor={Object.fromEntries(
          [WHOLE_TEAM, ...team].map((name) => [name, withQuery("/matrix", { owner: name === WHOLE_TEAM ? null : name, q: selected })]),
        )}
      />
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
  const topIds = rankByPriority(lines)
    .slice(0, 6)
    .map((line) => line.company.id);
  return (
    <>
      <div className="my-3.5 grid gap-3 md:grid-cols-2">
        {TILE_LAYOUT.map((key) => {
          const [name, help] = QUADRANTS[key];
          const count = rows.filter((row) => row.quadrant_key === key).length;
          return (
            <Link
              key={key}
              className="group/quad flex min-h-23 items-start gap-3 rounded-lg border bg-card px-3.5 py-3 no-underline transition-colors hover:border-foreground aria-[current=true]:border-foreground aria-[current=true]:bg-foreground"
              href={withQuery("/matrix", { owner: ownerParam, q: selected === key ? null : key })}
              aria-current={selected === key ? "true" : undefined}
              aria-label={`Show ${name} (${count})`}
            >
              <span className="min-w-11 font-display text-[38px] leading-none text-primary group-aria-[current=true]/quad:text-[#ff6b81]">
                {count}
              </span>
              <span>
                <span className="block font-bold text-foreground group-aria-[current=true]/quad:text-background">
                  {name}
                </span>
                <span className="mt-0.5 block text-[13.5px] leading-snug text-muted-foreground group-aria-[current=true]/quad:text-background">
                  {help}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-1 mb-2 flex flex-wrap gap-4.5 text-sm text-foreground/90">
        <span>
          <span className="text-warm">▲</span> Warm intro
        </span>
        <span>
          <span className="text-cold">●</span> Cold inbound
        </span>
        <span>Bubble size = touchpoints</span>
        <span>Dashed lines = quadrant splits</span>
        <span>Click a bubble to open the deal</span>
      </div>
      <MatrixChart
        rows={rows}
        labelledIds={topIds}
        splits={loadTriageConfig().matrix}
        dealHrefs={Object.fromEntries(rows.map((row) => [row.company_id, dealHref(row.company_id, currentHref)]))}
        priorityOrder={byPriority(rows).map((row) => row.company_id)}
      />
      <Caption>
        Points on the same value are spread slightly so none hide behind another; the tooltip shows the exact score and
        urgency. The six highest-priority deals are labelled.
      </Caption>

      <RememberDealList title={`Matrix: ${title}`} ids={shown.map((row) => row.company_id)} />
      <p>
        <strong>{title}</strong> · {shown.length} deals · highest priority first
      </p>
      <DataTable>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead className={NUM}>Score</TableHead>
            <TableHead className={NUM}>Urgency</TableHead>
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
