"use client";

/**
 * The priority matrix chart: every open, filter-passing deal on score % × urgency.
 *
 * Position is score and urgency, size is the number of touchpoints, and shape and colour both
 * show the source (warm intro ▲ or cold ●), so identity never rests on colour alone. Clicking
 * a bubble (or pressing Enter on it) opens the deal.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { MatrixRow } from "@/lib/triage/cockpit";

import { rememberDealList } from "./dealList";

export const WARM = "#C8102E"; // Skarv red; validated as a pair with COLD (CVD ΔE 21.9)
export const COLD = "#1F5FB8";
const INK = "#16161a";
const MUTED = "#5f5b55";

const WIDTH = 960;
const HEIGHT = 520;
const MARGIN = { top: 12, right: 18, bottom: 104, left: 56 };
const PLOT_W = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom;
const Y_DOMAIN: [number, number] = [20, 104];

/** Vega's size channel is the symbol's area in px²: touchpoints 1–5 → 90–520. */
function symbolArea(touchpoints: number): number {
  return 90 + ((touchpoints - 1) / (5 - 1)) * (520 - 90);
}

function symbolPath(source: MatrixRow["Source"], area: number): string {
  if (source === "Warm intro") {
    const side = Math.sqrt((4 * area) / Math.sqrt(3));
    const height = (Math.sqrt(3) / 2) * side;
    // Centroid at the origin.
    return `M0,${(-2 * height) / 3}L${side / 2},${height / 3}L${-side / 2},${height / 3}Z`;
  }
  const radius = Math.sqrt(area / Math.PI);
  return `M${radius},0A${radius},${radius} 0 1,1 ${-radius},0A${radius},${radius} 0 1,1 ${radius},0Z`;
}

function niceTicks(low: number, high: number, count: number): number[] {
  const raw = (high - low) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= raw) ?? raw;
  const ticks: number[] = [];
  for (let value = Math.ceil(low / step) * step; value <= high + 1e-9; value += step) ticks.push(Number(value.toFixed(6)));
  return ticks;
}

export function MatrixChart({
  rows,
  labelledIds,
  splits,
  dealHrefs,
  priorityOrder,
}: {
  rows: MatrixRow[];
  labelledIds: number[];
  splits: { score_split: number; urgency_split: number };
  dealHrefs: Record<number, string>;
  /** Company ids by priority, highest first: the list a bubble opens the deal in. */
  priorityOrder: number[];
}) {
  const router = useRouter();
  const [hovered, setHovered] = useState<MatrixRow | null>(null);

  const xMax = Math.max(60, Math.max(...rows.map((row) => row["Score %"])) + 8);
  const sx = (value: number) => MARGIN.left + (value / xMax) * PLOT_W;
  const sy = (value: number) => MARGIN.top + PLOT_H - ((value - Y_DOMAIN[0]) / (Y_DOMAIN[1] - Y_DOMAIN[0])) * PLOT_H;
  const { score_split: scoreSplit, urgency_split: urgencySplit } = splits;

  const bands = [
    { x: scoreSplit, x2: xMax, y: urgencySplit, y2: 104, fill: "#f7e1e4" },
    { x: scoreSplit, x2: xMax, y: 20, y2: urgencySplit, fill: "#eef1f6" },
    { x: 0, x2: scoreSplit, y: urgencySplit, y2: 104, fill: "#f6efe6" },
    { x: 0, x2: scoreSplit, y: 20, y2: urgencySplit, fill: "#f3f1ed" },
  ];
  const labelled = rows
    .filter((row) => labelledIds.includes(row.company_id))
    .sort((a, b) => a.x - b.x);

  function open(row: MatrixRow) {
    rememberDealList("Priority matrix", priorityOrder);
    router.push(dealHrefs[row.company_id]);
  }

  const legendY = HEIGHT - 40;
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Priority matrix: score % against urgency">
        {bands.map((band) => (
          <rect
            key={band.fill}
            x={sx(band.x)}
            y={sy(band.y2)}
            width={sx(band.x2) - sx(band.x)}
            height={sy(band.y) - sy(band.y2)}
            fill={band.fill}
            opacity={0.9}
          />
        ))}
        <rect x={MARGIN.left} y={MARGIN.top} width={PLOT_W} height={PLOT_H} fill="none" stroke="#e2ddd5" />

        {/* axes */}
        {niceTicks(0, xMax, 6).map((tick) => (
          <g key={`x${tick}`} transform={`translate(${sx(tick)},${MARGIN.top + PLOT_H})`}>
            <line y2={5} stroke="#c9c3ba" />
            <text y={18} textAnchor="middle" fontSize={12} fill={MUTED}>
              {tick}
            </text>
          </g>
        ))}
        {niceTicks(Y_DOMAIN[0], Y_DOMAIN[1], 5).map((tick) => (
          <g key={`y${tick}`} transform={`translate(${MARGIN.left},${sy(tick)})`}>
            <line x2={-5} stroke="#c9c3ba" />
            <text x={-8} dy="0.32em" textAnchor="end" fontSize={12} fill={MUTED}>
              {tick}
            </text>
          </g>
        ))}
        <line x1={MARGIN.left} x2={MARGIN.left + PLOT_W} y1={MARGIN.top + PLOT_H} y2={MARGIN.top + PLOT_H} stroke="#c9c3ba" />
        <line x1={MARGIN.left} x2={MARGIN.left} y1={MARGIN.top} y2={MARGIN.top + PLOT_H} stroke="#c9c3ba" />
        <text x={MARGIN.left + PLOT_W / 2} y={MARGIN.top + PLOT_H + 38} textAnchor="middle" fontSize={13} fontWeight={700} fill={INK}>
          Score % (fit)
        </text>
        <text
          transform={`translate(${MARGIN.left - 40},${MARGIN.top + PLOT_H / 2}) rotate(-90)`}
          textAnchor="middle"
          fontSize={13}
          fontWeight={700}
          fill={INK}
        >
          Urgency
        </text>

        {/* quadrant splits and corner labels */}
        <line x1={sx(scoreSplit)} x2={sx(scoreSplit)} y1={sy(104)} y2={sy(20)} stroke={INK} strokeDasharray="4 4" strokeWidth={1.5} />
        <line x1={sx(0)} x2={sx(xMax)} y1={sy(urgencySplit)} y2={sy(urgencySplit)} stroke={INK} strokeDasharray="4 4" strokeWidth={1.5} />
        <text x={sx(xMax - 1)} y={sy(102)} dy="0.8em" textAnchor="end" fontSize={13} fontWeight={700} fill={MUTED}>
          ACT NOW
        </text>
        <text x={sx(xMax - 1)} y={sy(22)} textAnchor="end" fontSize={13} fontWeight={700} fill={MUTED}>
          PLAN A DEEP DIVE
        </text>
        <text x={sx(1)} y={sy(102)} dy="0.8em" textAnchor="start" fontSize={13} fontWeight={700} fill={MUTED}>
          REPLY FAST
        </text>
        <text x={sx(1)} y={sy(22)} textAnchor="start" fontSize={13} fontWeight={700} fill={MUTED}>
          PARK OR PASS
        </text>

        {/* bubbles */}
        {rows.map((row) => (
          <g
            key={row.company_id}
            className="chart-point"
            transform={`translate(${sx(row.x)},${sy(row.y)})`}
            role="link"
            tabIndex={0}
            aria-label={`${row.Company}: score ${row["Score %"]}, urgency ${row.Urgency}, ${row.Source}, ${row.Quadrant}. Open the deal.`}
            onMouseEnter={() => setHovered(row)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(row)}
            onBlur={() => setHovered(null)}
            onClick={() => open(row)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                open(row);
              }
            }}
          >
            <path
              d={symbolPath(row.Source, symbolArea(row.Touchpoints))}
              fill={row.Source === "Warm intro" ? WARM : COLD}
              fillOpacity={0.85}
              stroke="#fbfaf8"
              strokeWidth={1.5}
            />
          </g>
        ))}

        {/* the six highest-priority deals, labels alternating above and below */}
        {labelled.map((row, index) => (
          <text
            key={`label-${row.company_id}`}
            x={sx(row.x) + 9}
            y={sy(row.y) + (index % 2 === 0 ? -9 : 11)}
            dy="0.32em"
            fontSize={12}
            fontWeight={600}
            fill={INK}
            pointerEvents="none"
          >
            {row.Company}
          </text>
        ))}

        {/* size legend */}
        <text x={MARGIN.left} y={legendY - 14} fontSize={12} fontWeight={700} fill={INK}>
          Touchpoints
        </text>
        {[1, 2, 3, 4, 5].map((value, index) => (
          <g key={value} transform={`translate(${MARGIN.left + 14 + index * 56},${legendY + 6})`}>
            <path d={symbolPath("Cold inbound", symbolArea(value))} fill="#9a948c" stroke="#9a948c" />
            <text x={16} dy="0.32em" fontSize={12} fill={INK}>
              {value}
            </text>
          </g>
        ))}
      </svg>
      {hovered ? (
        <div
          className="tooltip"
          style={{
            left: `${(sx(hovered.x) / WIDTH) * 100}%`,
            top: `${(sy(hovered.y) / HEIGHT) * 100}%`,
            transform: sx(hovered.x) > WIDTH * 0.65 ? "translate(calc(-100% - 14px), -50%)" : "translate(14px, -50%)",
          }}
          role="status"
        >
          <dl>
            {(["Company", "Quadrant", "Score %", "Urgency", "Touchpoints", "Source", "Next action", "Owner"] as const).map(
              (field) => (
                <div key={field}>
                  <dt>{field}</dt>
                  <dd>{hovered[field]}</dd>
                </div>
              ),
            )}
          </dl>
        </div>
      ) : null}
    </div>
  );
}
