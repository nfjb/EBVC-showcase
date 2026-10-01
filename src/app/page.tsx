/**
 * The Monday cockpit: one list of every company, its open tasks and the next step.
 *
 * Four views (My view, Team view, Pipeline, Hot topics) in a dark tab bar, five KPI tiles
 * that double as quick filters, and the priority table ranked by score % × urgency.
 * Urgency never includes time in queue. Status is always written out: red marks what is
 * urgent, and the words on the pill say why.
 */

import Link from "next/link";

import { ExportControls, NavigateSelect, NextActionPill, type PillAction } from "@/components/CockpitClient";
import { RememberDealList } from "@/components/dealList";
import { Metric } from "@/components/Metric";
import * as repo from "@/lib/db/repository";
import { dealHref, withQuery } from "@/lib/routes";
import { introReplyDialogData, passDialogData } from "@/lib/server/dialogData";
import { actingMember } from "@/lib/server/person";
import { cockpitLines } from "@/lib/server/views";
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

const VIEW_SLUGS: Record<string, View> = { my: "My view", team: "Team view", pipeline: "Pipeline", hot: "Hot topics" };
const SLUG_FOR_VIEW = Object.fromEntries(Object.entries(VIEW_SLUGS).map(([slug, view]) => [view, slug])) as Record<
  View,
  string
>;
const PAGE_SIZE = 30;

type Changes = Record<string, string | null>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function CockpitPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const view: View = VIEW_SLUGS[one(params.view)] ?? "My view";
  const tile: TileKey = one(params.tile) in TILES ? (one(params.tile) as TileKey) : "top";
  const showAll = one(params.all) === "1";
  const team = teamNames();
  const member = await actingMember();
  const owner = team.includes(one(params.owner)) ? one(params.owner) : member;

  const today = demoToday();
  const lines = cockpitLines(today);
  const state: Changes = { view: SLUG_FOR_VIEW[view], tile, owner: one(params.owner) || null, all: showAll ? "1" : null };
  const href = (changes: Changes) => withQuery("/", { ...state, ...changes });
  const currentHref = href({});

  return (
    <>
      <h1 className="display huge">The Monday Cockpit</h1>
      <div className="kicker">Skarv Ventures · deal-flow triage · {longDateWithYear(today)}</div>
      <p className="lede">One list: every company, its open tasks, the next step.</p>

      <div className="ck-bar">
        <nav className="ck-views" aria-label="View">
          {(Object.keys(SLUG_FOR_VIEW) as View[]).map((name) => (
            <Link
              key={name}
              href={href({ view: SLUG_FOR_VIEW[name] })}
              className="ck-view"
              aria-current={name === view ? "page" : undefined}
            >
              {name}
            </Link>
          ))}
        </nav>
        <div className="ck-live">
          <span className="dot" aria-hidden="true">
            ●
          </span>{" "}
          Demo Data
        </div>
      </div>

      <div className="sheet ck-sheet">
        {!lines.length ? (
          <div className="alert alert-info">
            No deals loaded yet. Upload <code>demo/inbound_records.csv</code> and <code>demo/signals.csv</code> as a{" "}
            <Link href="/uploads">Deal flow upload</Link>.
          </div>
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
  const filters = tileFilters(lines);
  const title = tileLabel(tile, view);
  const selected = filters[tile];
  // My view: act directly. Team view: see who owns each step, so it can be chased.
  const actionable = view === "My view";
  return (
    <>
      {view === "My view" ? (
        <NavigateSelect
          label="Deals owned by"
          value={owner}
          options={team}
          hrefFor={Object.fromEntries(team.map((name) => [name, href({ owner: name })]))}
        />
      ) : null}
      <div className="tiles no-print">
        {(Object.keys(TILES) as TileKey[]).map((key) => (
          <Link
            key={key}
            href={href({ tile: key })}
            className="tile"
            aria-current={key === tile ? "true" : undefined}
            aria-label={`Show ${tileLabel(key, view)} (${filters[key].length})`}
          >
            <span className={key === "drafts" || key === "tracking" ? "tile-number quiet" : "tile-number"}>
              {filters[key].length}
            </span>
            <span className="tile-label">{tileLabel(key, view)}</span>
          </Link>
        ))}
      </div>

      <div className="list-head">
        <span className="list-title">{title} · score × urgency</span>
      </div>
      {!selected.length ? (
        <p>✅ Nothing here right now.</p>
      ) : (
        <>
          <RememberDealList title={title} ids={selected.map((line) => line.company.id)} />
          <PriorityTable
            lines={showAll ? selected : selected.slice(0, PAGE_SIZE)}
            actionable={actionable}
            currentHref={currentHref}
          />
          {selected.length > PAGE_SIZE ? (
            <div className="no-print">
              <p className="caption">
                Showing {showAll ? selected.length : Math.min(PAGE_SIZE, selected.length)} of {selected.length}.
              </p>
              <Link className="toggle" href={href({ all: showAll ? null : "1" })} role="switch" aria-checked={showAll}>
                <span aria-hidden="true">{showAll ? "◉" : "○"}</span> Show all
              </Link>
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
          "Score %": line.score_percent,
          Urgency: line.urgency,
          "Open tasks": line.tasks.join("; "),
          "Next action": line.next_action,
          "Days in queue": line.days_in_queue,
          Owner: line.company.owner,
        }))}
      />
    </>
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
    <div className="assignee">
      <span className="who">{parts.owner}</span>
      {parts.role ? <span className="role"> · {capitalize(parts.role)}</span> : null}
      <span className={parts.hot ? "step hot" : "step"}>{parts.step}</span>
    </div>
  );
}

function PriorityTable({ lines, actionable, currentHref }: { lines: Line[]; actionable: boolean; currentHref: string }) {
  return (
    <div className="table-scroll">
      <table className="ck-table">
        <thead>
          <tr>
            <th className="rank">#</th>
            <th>Company</th>
            <th>Description</th>
            <th className="num">Score</th>
            <th className="num">Urgency</th>
            <th>Open tasks</th>
            <th>{actionable ? "Next action" : "Assigned to · next step"}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => {
            const company = line.company;
            const detail =
              `${company.stage} · ${company.country}` +
              (!company.passed_hard_filters ? ` · failed: ${label(PASS_CODE_LABELS, company.pass_code)}` : "") +
              (line.flag && company.passed_hard_filters ? ` · ⏳ ${line.flag}` : "");
            const tasksText = line.tasks.join(", ") || "No open tasks";
            const overdue = line.intro_state?.past_deadline ? "⚠ " : "";
            return (
              <tr key={company.id}>
                <td className="rank">
                  {index + 1}
                  {company.rank_override ? (
                    <span title={`Pinned: ${company.rank_override_comment}`}> 📌</span>
                  ) : null}
                </td>
                <td>
                  <Link className="company" href={dealHref(company.id, currentHref)} title="Open the deal">
                    {company.name}
                  </Link>
                </td>
                <td>
                  <div className="desc">
                    {company.one_liner}
                    <small>{detail}</small>
                  </div>
                </td>
                <td className="score-cell">{line.score_percent}</td>
                <td className={line.urgency >= 80 ? "score-cell hot" : "score-cell"}>{line.urgency}</td>
                <td style={{ textAlign: "center" }}>
                  <span
                    className={line.urgent ? "badge hot" : "badge"}
                    title={tasksText}
                    aria-label={`${line.tasks.length} open tasks: ${tasksText}`}
                  >
                    {line.tasks.length}
                  </span>
                </td>
                <td>
                  {actionable ? (
                    <NextActionPill
                      label={`${overdue}${line.next_action} →`}
                      hot={line.urgent}
                      action={pillAction(line, currentHref)}
                    />
                  ) : (
                    <Assignee line={line} />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
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
      <div className="metrics">
        <Metric label="Inbound records" value={repo.countTouchpoints()} />
        <Metric label="Companies after merging" value={lines.length} />
        <Metric label="Passed hard filters" value={passed.length} />
        <Metric label="Decided by the team" value={lines.filter((line) => line.company.status !== "open").length} />
      </div>
      <div className="grid-2">
        <div>
          <p>
            <strong>Why companies failed the hard filters</strong>
          </p>
          <CountTable heading="Reason" countHeading="Companies" rows={failures} />
        </div>
        <div>
          <p>
            <strong>Inbound by channel</strong>
          </p>
          <CountTable heading="Channel" countHeading="Records" rows={channels} />
        </div>
      </div>
    </>
  );
}

function CountTable({ heading, countHeading, rows }: { heading: string; countHeading: string; rows: [string, number][] }) {
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>{heading}</th>
            <th className="num">{countHeading}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, value]) => (
            <tr key={name}>
              <td>{name}</td>
              <td className="num">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
      <div className="list-head">
        <span className="list-title">Hot topics · signals from the last {windowDays} days</span>
        <span className="hint">Hires, traction and news on open deals</span>
      </div>
      {!recent.length ? (
        <p>Nothing new in the window.</p>
      ) : (
        <div className="table-scroll">
          <table className="ck-table">
            <thead>
              <tr>
                <th className="rank">Date</th>
                <th>Company</th>
                <th>Signal</th>
                <th>Assigned to · next step</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((line) => (
                <tr key={line.company.id}>
                  <td className="rank">{dayMonth(line.company.latest_signal_at!)}</td>
                  <td>
                    <Link className="company" href={dealHref(line.company.id, currentHref)}>
                      {line.company.name}
                    </Link>
                  </td>
                  <td>
                    <div className="desc">{line.company.latest_signal}</div>
                  </td>
                  <td>
                    <Assignee line={line} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
