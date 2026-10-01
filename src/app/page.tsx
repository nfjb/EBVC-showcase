"use client";

/**
 * The Monday cockpit: one list of every company, its open tasks and the next step.
 *
 * Four views (My view, Team view, Pipeline, Hot topics) in a dark tab bar, five KPI tiles
 * that double as quick filters, and the priority table ranked by score % × urgency.
 * Urgency never includes time in queue. Status is always written out: red marks what is
 * urgent, and the words on the pill say why.
 */

import { CircleCheck, Hourglass, Pin } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ExportControls, NavigateSelect, NextActionPill, type PillAction } from "@/components/CockpitClient";
import { RememberDealList } from "@/components/dealList";
import { HeaderActions } from "@/components/HeaderActions";
import { UrgencyHeader, UrgencyValue } from "@/components/UrgencyScore";
import { Caption, DataTable, Metric, Metrics, NUM, PageHeader } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useActingMember, useCrm, useSearchRecord } from "@/components/useCrm";
import * as repo from "@/lib/db/repository";
import { dealHref, withQuery } from "@/lib/routes";
import { introReplyDialogData, passDialogData } from "@/lib/crm/dialogData";
import { cockpitLines } from "@/lib/crm/views";
import {
  assigneeParts,
  capitalize,
  tileFilters,
  tileLabel,
  TILES,
  type Line,
  type TileKey,
  type View,
} from "@/lib/triage/cockpit";
import { demoToday, loadTriageConfig, teamNames } from "@/lib/triage/config";
import { dayMonth, daysBetween, longDateWithYear, type IsoDate } from "@/lib/triage/dates";
import { CHANNEL_LABELS, label, PASS_CODE_LABELS } from "@/lib/triage/labels";
import { ratedCount } from "@/lib/triage/scoring";
import { cn } from "@/lib/utils";

import { EmptyCrm } from "./deals/EmptyCrm";

const VIEW_SLUGS: Record<string, View> = { my: "My view", team: "Team view", pipeline: "Pipeline", hot: "Hot topics" };
const SLUG_FOR_VIEW = Object.fromEntries(Object.entries(VIEW_SLUGS).map(([slug, view]) => [view, slug])) as Record<
  View,
  string
>;
const PAGE_SIZE = 30;

type Changes = Record<string, string | null>;

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default function CockpitPage() {
  useCrm();
  const params = useSearchRecord();
  const member = useActingMember();
  const view: View = VIEW_SLUGS[one(params.view)] ?? "My view";
  const tile: TileKey = one(params.tile) in TILES ? (one(params.tile) as TileKey) : "top";
  const showAll = one(params.all) === "1";
  const team = teamNames();
  const owner = team.includes(one(params.owner)) ? one(params.owner) : member;

  const router = useRouter();
  const today = demoToday();
  const lines = cockpitLines(today);
  const state: Changes = { view: SLUG_FOR_VIEW[view], tile, owner: one(params.owner) || null, all: showAll ? "1" : null };
  const href = (changes: Changes) => withQuery("/", { ...state, ...changes });
  const currentHref = href({});

  return (
    <>
      <PageHeader
        title="Monday cockpit"
        eyebrow={longDateWithYear(today)}
        description="One list: every company, its open tasks, the next step."
        actions={
          <Badge variant="outline" className="gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" /> Demo data
          </Badge>
        }
      />

      <Tabs value={SLUG_FOR_VIEW[view]} onValueChange={(slug) => router.push(href({ view: slug }))}>
        <TabsList className="print:hidden" aria-label="View">
          {(Object.keys(SLUG_FOR_VIEW) as View[]).map((name) => (
            <TabsTrigger key={name} value={SLUG_FOR_VIEW[name]}>
              {name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-4">
        {!lines.length ? (
          <EmptyCrm title="" />
        ) : view === "Pipeline" ? (
          <PipelineView lines={lines} />
        ) : view === "Hot topics" ? (
          <HotTopics lines={lines} today={today} currentHref={currentHref} />
        ) : (
          <WorkList
            lines={view === "My view" ? lines.filter((line) => line.company.owner === owner) : lines}
            view={view}
            tile={tile}
            owner={owner}
            team={team}
            showAll={showAll}
            today={today}
            href={href}
            currentHref={currentHref}
          />
        )}
      </div>
    </>
  );
}

function WorkList({
  lines,
  view,
  tile,
  owner,
  team,
  showAll,
  today,
  href,
  currentHref,
}: {
  lines: Line[];
  view: View;
  tile: TileKey;
  owner: string;
  team: string[];
  showAll: boolean;
  today: IsoDate;
  href: (changes: Changes) => string;
  currentHref: string;
}) {
  const router = useRouter();
  const filters = tileFilters(lines);
  const title = tileLabel(tile, view);
  const selected = filters[tile];
  // My view: act directly. Team view: see who owns each step, so it can be chased.
  const actionable = view === "My view";
  return (
    <>
      {view === "My view" ? (
        <HeaderActions>
          <NavigateSelect
            label="Deals owned by"
            value={owner}
            options={team}
            hrefFor={Object.fromEntries(team.map((name) => [name, href({ owner: name })]))}
          />
        </HeaderActions>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-5 print:hidden">
        {(Object.keys(TILES) as TileKey[]).map((key) => {
          const quiet = key === "drafts" || key === "tracking";
          const active = key === tile;
          return (
            <Link
              key={key}
              href={href({ tile: key })}
              className="rounded-xl no-underline"
              aria-current={active ? "true" : undefined}
              aria-label={`Show ${tileLabel(key, view)} (${filters[key].length})`}
            >
              <Card
                className={cn(
                  "gap-1 py-3 transition-shadow hover:shadow-md",
                  active && "bg-primary/5 ring-2 ring-primary",
                )}
              >
                <CardHeader className="px-4">
                  <CardDescription>{tileLabel(key, view)}</CardDescription>
                  <CardTitle
                    className={cn("text-3xl font-semibold tabular-nums", quiet ? "text-foreground" : "text-primary")}
                  >
                    {filters[key].length}
                  </CardTitle>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>

      <ListHead title={`${title} · Importance Score × Urgency Score`} />
      {!selected.length ? (
        <p className="flex items-center gap-2">
          <CircleCheck className="size-4 text-success-foreground" aria-hidden="true" /> Nothing here right now.
        </p>
      ) : (
        <>
          <RememberDealList title={title} ids={selected.map((line) => line.company.id)} />
          <PriorityTable
            lines={showAll ? selected : selected.slice(0, PAGE_SIZE)}
            actionable={actionable}
            currentHref={currentHref}
          />
          {selected.length > PAGE_SIZE ? (
            <div className="print:hidden">
              <Caption>
                Showing {showAll ? selected.length : Math.min(PAGE_SIZE, selected.length)} of {selected.length}.
              </Caption>
              <div className="flex items-center gap-2">
                <Switch
                  id="show-all"
                  checked={showAll}
                  onCheckedChange={(checked) => router.push(href({ all: checked ? "1" : null }))}
                />
                <Label htmlFor="show-all">Show all</Label>
              </div>
            </div>
          ) : null}
        </>
      )}
      <ExportControls
        fileName={`skarv-${title.toLowerCase().replaceAll(" ", "-")}-${today}.csv`}
        rows={selected.map((line, index) => ({
          Rank: index + 1,
          Company: line.company.name,
          Website: line.company.website_domain,
          Description: line.company.one_liner,
          Stage: line.company.stage,
          Country: line.company.country,
          "Importance Score": line.score_percent,
          "Urgency Score": line.urgency,
          "Open tasks": line.tasks.join("; "),
          "Next action": line.next_action,
          "Days in queue": line.days_in_queue,
          Owner: line.company.owner,
        }))}
      />
    </>
  );
}

function ListHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mt-6 mb-2 flex flex-wrap items-baseline justify-between gap-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {hint ? <span className="text-sm text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

function pillAction(line: Line, currentHref: string): PillAction {
  if (line.next_action_kind === "intro" && line.intro) {
    return { kind: "intro", data: introReplyDialogData(line.intro, line.company) };
  }
  if (line.next_action_kind === "pass_draft") return { kind: "pass_draft", data: passDialogData(line.company) };
  if (line.next_action_kind === "merge") return { kind: "link", href: "/merges" };
  return { kind: "link", href: dealHref(line.company.id, currentHref) };
}

function Assignee({ line }: { line: Line }) {
  const parts = assigneeParts(line);
  return (
    <div className="leading-snug">
      <span className="text-[15px] font-bold">{parts.owner}</span>
      {parts.role ? <span className="text-[13px] text-muted-foreground"> · {capitalize(parts.role)}</span> : null}
      <span className={cn("mt-0.5 block text-[13px]", parts.hot ? "font-semibold text-hot" : "text-foreground/85")}>
        {parts.step}
      </span>
    </div>
  );
}

function PriorityTable({ lines, actionable, currentHref }: { lines: Line[]; actionable: boolean; currentHref: string }) {
  return (
    <CockpitTable>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={RANK}>#</TableHead>
          <TableHead>Company</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className={NUM}>Importance Score</TableHead>
          <TableHead className={NUM}>
            <UrgencyHeader />
          </TableHead>
          <TableHead>Open tasks</TableHead>
          <TableHead>{actionable ? "Next action" : "Assigned to · next step"}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((line, index) => {
          const company = line.company;
          const detail =
            `${company.stage} · ${company.country}` +
            (!company.passed_hard_filters ? ` · failed: ${label(PASS_CODE_LABELS, company.pass_code)}` : "");
          const tasksText = line.tasks.join(", ") || "No open tasks";
          return (
            <TableRow key={company.id}>
              <TableCell className={RANK}>
                {index + 1}
                {company.rank_override ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0} className="ml-1 inline-flex">
                        <Pin className="size-3.5 text-primary" aria-label={`Pinned: ${company.rank_override_comment}`} />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Pinned: {company.rank_override_comment}</TooltipContent>
                  </Tooltip>
                ) : null}
              </TableCell>
              <TableCell>
                <Link
                  className="text-base font-bold text-foreground no-underline hover:text-primary hover:underline"
                  href={dealHref(company.id, currentHref)}
                  title="Open the deal"
                >
                  {company.name}
                </Link>
              </TableCell>
              <TableCell className="min-w-64 whitespace-normal">
                <div className="leading-snug text-foreground/90">
                  {company.one_liner}
                  <small className="mt-0.5 block text-[13px] leading-tight text-muted-foreground">
                    {detail}
                    {line.flag && company.passed_hard_filters ? (
                      <>
                        {" · "}
                        <Hourglass className="inline size-3" aria-hidden="true" /> {line.flag}
                      </>
                    ) : null}
                  </small>
                </div>
              </TableCell>
              <TableCell className={cn(NUM, "text-base")}>
                {ratedCount(company) ? (
                  line.score_percent
                ) : (
                  <span className="text-muted-foreground" title="No Fathom rating yet">
                    –<span className="sr-only">not rated</span>
                  </span>
                )}
              </TableCell>
              <TableCell className={cn(NUM, "text-base")}>
                <UrgencyValue value={line.urgency} reason={line.urgency_reason} hot={line.urgency >= 80} />
              </TableCell>
              <TableCell className="text-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      tabIndex={0}
                      variant={line.urgent ? "default" : "secondary"}
                      className="h-6 min-w-7 font-semibold"
                      aria-label={`${line.tasks.length} open tasks: ${tasksText}`}
                    >
                      {line.tasks.length}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>{tasksText}</TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell>
                {actionable ? (
                  <NextActionPill
                    label={`${line.intro_state?.past_deadline ? "⚠ " : ""}${line.next_action} →`}
                    hot={line.urgent}
                    action={pillAction(line, currentHref)}
                  />
                ) : (
                  <Assignee line={line} />
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </CockpitTable>
  );
}

const RANK = "w-10 text-right text-muted-foreground tabular-nums";

/** The cockpit's tables: bordered, on a card. */
function CockpitTable({ children }: { children: ReactNode }) {
  return <DataTable>{children}</DataTable>;
}

/** ``Series.value_counts()``: most frequent first; ties keep first-seen order. */
function valueCounts(values: string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function PipelineView({ lines }: { lines: Line[] }) {
  const passed = lines.filter((line) => line.company.passed_hard_filters);
  const failures = valueCounts(
    lines.filter((line) => !line.company.passed_hard_filters).map((line) => label(PASS_CODE_LABELS, line.company.pass_code)),
  );
  const channels = valueCounts(repo.listTouchpoints().map((touchpoint) => label(CHANNEL_LABELS, touchpoint.channel)));
  return (
    <>
      <Metrics>
        <Metric label="Inbound records" value={repo.countTouchpoints()} />
        <Metric label="Companies after merging" value={lines.length} />
        <Metric label="Passed hard filters" value={passed.length} />
        <Metric label="Decided by the team" value={lines.filter((line) => line.company.status !== "open").length} />
      </Metrics>
      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardContent>
            <p className="mb-2 font-bold">Why companies failed the hard filters</p>
            <CountTable heading="Reason" countHeading="Companies" rows={failures} />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="mb-2 font-bold">Inbound by channel</p>
            <CountTable heading="Channel" countHeading="Records" rows={channels} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function CountTable({ heading, countHeading, rows }: { heading: string; countHeading: string; rows: [string, number][] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{heading}</TableHead>
          <TableHead className={NUM}>{countHeading}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(([name, value]) => (
          <TableRow key={name}>
            <TableCell>{name}</TableCell>
            <TableCell className={NUM}>{value}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function HotTopics({ lines, today, currentHref }: { lines: Line[]; today: IsoDate; currentHref: string }) {
  const windowDays = loadTriageConfig().urgency.signal_days;
  const recent = lines
    .filter(
      (line) =>
        line.company.latest_signal_at &&
        daysBetween(line.company.latest_signal_at, today) <= windowDays &&
        line.company.status === "open",
    )
    .sort((a, b) =>
      a.company.latest_signal_at === b.company.latest_signal_at
        ? 0
        : a.company.latest_signal_at! < b.company.latest_signal_at!
          ? 1
          : -1,
    );
  return (
    <>
      <RememberDealList title="Hot topics" ids={recent.map((line) => line.company.id)} />
      <ListHead
        title={`Hot topics · signals from the last ${windowDays} days`}
        hint="Hires, traction and news on open deals"
      />
      {!recent.length ? (
        <p>Nothing new in the window.</p>
      ) : (
        <CockpitTable>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn(RANK, "w-16")}>Date</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Signal</TableHead>
              <TableHead>Assigned to · next step</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recent.map((line) => (
              <TableRow key={line.company.id}>
                <TableCell className={cn(RANK, "w-16")}>{dayMonth(line.company.latest_signal_at!)}</TableCell>
                <TableCell>
                  <Link
                    className="text-base font-bold text-foreground no-underline hover:text-primary hover:underline"
                    href={dealHref(line.company.id, currentHref)}
                  >
                    {line.company.name}
                  </Link>
                </TableCell>
                <TableCell className="min-w-64 whitespace-normal leading-snug">{line.company.latest_signal}</TableCell>
                <TableCell>
                  <Assignee line={line} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </CockpitTable>
      )}
    </>
  );
}
