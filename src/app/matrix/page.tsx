/**
 * The priority matrix: every open, filter-passing deal on score % × urgency.
 *
 * Four quadrants (Act now · Plan a deep dive · Reply fast · Park or pass) split at the
 * lines in ``config/weights.yaml`` → ``matrix``. Clicking a bubble opens the deal.
 */

import Link from "next/link";

import { NavigateSelect } from "@/components/CockpitClient";
import { RememberDealList } from "@/components/dealList";
import { COLD, MatrixChart, WARM } from "@/components/MatrixChart";
import { dealHref, withQuery } from "@/lib/routes";
import { cockpitLines } from "@/lib/server/views";
import { byPriority, byPriorityThenScore, matrixRows, QUADRANT_ORDER } from "@/lib/triage/cockpit";
import { demoToday, loadTriageConfig, teamNames } from "@/lib/triage/config";
import { QUADRANTS, rankByPriority, type QuadrantKey } from "@/lib/triage/urgency";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

const WHOLE_TEAM = "Whole team";
// Tiles laid out like the chart: urgent on top, higher score on the right.
const TILE_LAYOUT: QuadrantKey[] = ["reply_fast", "act_now", "park", "plan"];

export default async function MatrixPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
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
      <div className="eyebrow">Score × urgency</div>
      <h1 className="display large">Priority matrix</h1>
      <p className="lede">
        Every open deal that passed the hard filters, placed by fit and urgency. Time in queue is not part of either
        axis.
      </p>
      <NavigateSelect
        label="Deals owned by"
        value={owner}
        options={[WHOLE_TEAM, ...team]}
        hrefFor={Object.fromEntries(
          [WHOLE_TEAM, ...team].map((name) => [name, withQuery("/matrix", { owner: name === WHOLE_TEAM ? null : name, q: selected })]),
        )}
      />
      {!rows.length ? (
        <div className="alert alert-info">No open deals for this owner.</div>
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
      <div className="quads">
        {TILE_LAYOUT.map((key) => {
          const [name, help] = QUADRANTS[key];
          const count = rows.filter((row) => row.quadrant_key === key).length;
          return (
            <Link
              key={key}
              className="quad"
              href={withQuery("/matrix", { owner: ownerParam, q: selected === key ? null : key })}
              aria-current={selected === key ? "true" : undefined}
              aria-label={`Show ${name} (${count})`}
            >
              <span className="quad-count">{count}</span>
              <span>
                <span className="quad-name">{name}</span>
                <span className="quad-help" style={{ display: "block" }}>
                  {help}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      <div className="legend">
        <span>
          <span style={{ color: WARM }}>▲</span> Warm intro
        </span>
        <span>
          <span style={{ color: COLD }}>●</span> Cold inbound
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
      <p className="caption">
        Points on the same value are spread slightly so none hide behind another; the tooltip shows the exact score and
        urgency. The six highest-priority deals are labelled.
      </p>

      <RememberDealList title={`Matrix: ${title}`} ids={shown.map((row) => row.company_id)} />
      <p>
        <strong>{title}</strong> · {shown.length} deals · highest priority first
      </p>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Company</th>
              <th className="num">Score</th>
              <th className="num">Urgency</th>
              <th className="num">Touch­points</th>
              <th>Source</th>
              <th>Next action</th>
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, 30).map((row) => (
              <tr key={row.company_id}>
                <td>
                  <Link className="link-button" href={dealHref(row.company_id, currentHref)}>
                    {row.Company}
                  </Link>
                </td>
                <td className="num">{row["Score %"]}</td>
                <td className="num">{row.Urgency}</td>
                <td className="num">{row.Touchpoints}</td>
                <td>{row.Source}</td>
                <td>{row["Next action"]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown.length > 30 ? (
        <p className="caption">Showing the first 30 of {shown.length}. Pick a quadrant above to narrow the list.</p>
      ) : null}
    </>
  );
}
