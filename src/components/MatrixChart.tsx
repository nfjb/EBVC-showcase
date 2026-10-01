"use client";

/**
 * The priority matrix chart (shadcn Chart on Recharts, in a Card): every open, filter-passing
 * deal on Fathom score % × urgency.
 *
 * Position is score and urgency, size is the number of touchpoints, and shape and colour both
 * show the source (warm intro ▲ or cold ●), so identity never rests on colour alone. The four
 * quadrants share their colours with the tiles above the chart. Clicking a bubble opens the
 * deal; the table under the chart lists the same deals as links, which is the keyboard and
 * screen-reader route.
 */

import { useRouter } from "next/navigation";
import {
  CartesianGrid,
  LabelList,
  ReferenceArea,
  ReferenceLine,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import type { MatrixRow } from "@/lib/triage/cockpit";
import type { QuadrantKey } from "@/lib/triage/urgency";

import { rememberDealList } from "./dealList";

/** One colour per quadrant, shared by the chart and the quadrant tiles (theme tokens). */
export const QUADRANT_COLOURS: Record<QuadrantKey, string> = {
  act_now: "var(--act)",
  plan: "var(--plan)",
  reply_fast: "var(--reply)",
  park: "var(--park)",
};

const Y_DOMAIN: [number, number] = [20, 100];
const TOOLTIP_FIELDS = [
  ["Quadrant", "Quadrant"],
  ["Score %", "Importance Score"],
  ["Urgency", "Urgency Score"],
  ["Touchpoints", "Touchpoints"],
  ["Source", "Source"],
  ["Next action", "Next action"],
  ["Owner", "Owner"],
] as const;

const CONFIG = {
  warm: { label: "Warm intro", color: "var(--warm)" },
  cold: { label: "Cold inbound", color: "var(--cold)" },
} satisfies ChartConfig;

/** The score axis, zoomed to the deals (in tens) but always showing the score split. */
function scoreDomain(rows: MatrixRow[], split: number): [number, number] {
  const xs = rows.map((row) => row.x);
  const low = Math.max(0, Math.floor((Math.min(split, ...xs) - 4) / 10) * 10);
  const high = Math.min(100, Math.ceil((Math.max(split, ...xs) + 4) / 10) * 10);
  return [low, high];
}

/**
 * Of the labelled deals (highest priority first), keep those whose label would not collide
 * with one already placed; the tooltip still names every deal.
 */
function placeLabels(rows: MatrixRow[], labelledIds: number[], xSpan: number): Set<number> {
  const byId = new Map(rows.map((row) => [row.company_id, row]));
  const placed: MatrixRow[] = [];
  for (const id of labelledIds) {
    const row = byId.get(id);
    if (!row) continue;
    const clear = placed.every(
      (other) =>
        Math.abs(other.x - row.x) > xSpan * 0.14 || Math.abs(other.y - row.y) > (Y_DOMAIN[1] - Y_DOMAIN[0]) * 0.06,
    );
    if (clear) placed.push(row);
  }
  return new Set(placed.map((row) => row.company_id));
}

function DealTooltip({ active, payload }: { active?: boolean; payload?: { payload: MatrixRow }[] }) {
  const row = active ? payload?.[0]?.payload : undefined;
  if (!row) return null;
  return (
    <div className="grid min-w-52 gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
      <div className="flex items-center gap-2 font-medium">
        <span
          className="size-2 rounded-full"
          style={{ background: QUADRANT_COLOURS[row.quadrant_key] }}
          aria-hidden="true"
        />
        {row.Company}
      </div>
      <dl className="grid gap-0.5">
        {TOOLTIP_FIELDS.map(([field, fieldLabel]) => (
          <div key={field} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{fieldLabel}</dt>
            <dd className="font-medium text-foreground tabular-nums">{row[field]}</dd>
          </div>
        ))}
      </dl>
      <p className="max-w-60 border-t pt-1.5 text-muted-foreground">{row.urgency_reason}</p>
    </div>
  );
}

/** The chart's legend, with the real symbols. */
function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <li className="flex items-center gap-1.5">
        <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
          <path d="M6 1 11 11H1Z" fill="var(--warm)" />
        </svg>
        Warm intro
      </li>
      <li className="flex items-center gap-1.5">
        <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
          <circle cx="6" cy="6" r="5" fill="var(--cold)" />
        </svg>
        Cold inbound
      </li>
      <li className="flex items-center gap-1.5">
        <svg viewBox="0 0 28 12" className="h-3 w-7" aria-hidden="true">
          <circle cx="4" cy="6" r="2.5" fill="currentColor" opacity="0.5" />
          <circle cx="17" cy="6" r="5" fill="currentColor" opacity="0.5" />
        </svg>
        Size = touchpoints
      </li>
      <li className="flex items-center gap-1.5">
        <svg viewBox="0 0 20 12" className="h-3 w-5" aria-hidden="true">
          <line x1="0" y1="6" x2="20" y2="6" stroke="currentColor" strokeDasharray="3 3" />
        </svg>
        Quadrant split
      </li>
    </ul>
  );
}

export function MatrixChart({
  rows,
  labelledIds,
  splits,
  dealHrefs,
  priorityOrder,
}: {
  rows: MatrixRow[];
  /** Deals worth a label, highest priority first. */
  labelledIds: number[];
  splits: { score_split: number; urgency_split: number };
  dealHrefs: Record<number, string>;
  /** Company ids by priority, highest first: the list a bubble opens the deal in. */
  priorityOrder: number[];
}) {
  const router = useRouter();
  const { score_split: scoreSplit, urgency_split: urgencySplit } = splits;
  const [xLow, xHigh] = scoreDomain(rows, scoreSplit);
  const labelled = placeLabels(rows, labelledIds, xHigh - xLow);
  const xTicks = Array.from({ length: (xHigh - xLow) / 10 + 1 }, (_, index) => xLow + index * 10);

  function open(row: MatrixRow | undefined) {
    if (!row) return;
    rememberDealList("Priority matrix", priorityOrder);
    router.push(dealHrefs[row.company_id]);
  }

  const zones: { key: QuadrantKey; name: string; x1: number; x2: number; y1: number; y2: number; position: string }[] =
    [
      {
        key: "reply_fast",
        name: "Reply fast",
        x1: xLow,
        x2: scoreSplit,
        y1: urgencySplit,
        y2: Y_DOMAIN[1],
        position: "insideTopLeft",
      },
      {
        key: "act_now",
        name: "Act now",
        x1: scoreSplit,
        x2: xHigh,
        y1: urgencySplit,
        y2: Y_DOMAIN[1],
        position: "insideTopRight",
      },
      {
        key: "park",
        name: "Park or pass",
        x1: xLow,
        x2: scoreSplit,
        y1: Y_DOMAIN[0],
        y2: urgencySplit,
        position: "insideBottomLeft",
      },
      {
        key: "plan",
        name: "Plan a deep dive",
        x1: scoreSplit,
        x2: xHigh,
        y1: Y_DOMAIN[0],
        y2: urgencySplit,
        position: "insideBottomRight",
      },
    ];

  const series = [
    { key: "cold" as const, shape: "circle" as const, data: rows.filter((row) => row.Source !== "Warm intro") },
    { key: "warm" as const, shape: "triangle" as const, data: rows.filter((row) => row.Source === "Warm intro") },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{rows.length} open deals by Importance Score and Urgency Score</CardTitle>
        <CardDescription>Hover a deal for details; click it to open the deal.</CardDescription>
        <CardAction className="max-sm:col-start-1 max-sm:row-start-3 max-sm:justify-self-start">
          <Legend />
        </CardAction>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={CONFIG}
          className="aspect-auto h-[460px] w-full"
          role="img"
          aria-label="Priority matrix: Importance Score against Urgency Score. The table below lists every deal shown."
        >
          <ScatterChart margin={{ top: 8, right: 16, bottom: 28, left: 0 }}>
            {zones.map((zone) => (
              <ReferenceArea
                key={zone.key}
                x1={zone.x1}
                x2={zone.x2}
                y1={zone.y1}
                y2={zone.y2}
                fill={QUADRANT_COLOURS[zone.key]}
                fillOpacity={0.06}
                stroke="none"
                label={{
                  value: zone.name.toUpperCase(),
                  position: zone.position as "insideTopLeft",
                  fill: QUADRANT_COLOURS[zone.key],
                  className: "text-[11px] font-semibold tracking-wider",
                }}
              />
            ))}
            <CartesianGrid strokeDasharray="2 4" strokeOpacity={0.6} />
            <XAxis
              type="number"
              dataKey="x"
              name="Importance Score"
              domain={[xLow, xHigh]}
              ticks={xTicks}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) => `${value} %`}
              label={{
                value: "Importance Score",
                position: "insideBottom",
                offset: -18,
                className: "fill-muted-foreground text-xs",
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Urgency Score"
              domain={Y_DOMAIN}
              ticks={[20, 40, 60, 80, 100]}
              tickLine={false}
              axisLine={false}
              width={44}
              label={{
                value: "Urgency Score",
                angle: -90,
                position: "insideLeft",
                offset: 6,
                className: "fill-muted-foreground text-xs",
              }}
            />
            {/* Recharts reads ``range`` as the symbol's area in px²: touchpoints 1–5 → 70–420. */}
            <ZAxis type="number" dataKey="Touchpoints" domain={[1, 5]} range={[70, 420]} />
            <ReferenceLine x={scoreSplit} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
            <ReferenceLine y={urgencySplit} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
            <ChartTooltip cursor={false} content={<DealTooltip />} />
            {series.map(({ key, shape, data }) => (
              <Scatter
                key={key}
                name={CONFIG[key].label}
                data={data}
                shape={shape}
                fill={`var(--color-${key})`}
                fillOpacity={0.75}
                stroke="var(--background)"
                strokeWidth={1.5}
                className="cursor-pointer"
                isAnimationActive={false}
                onClick={(point) => open((point as unknown as { payload?: MatrixRow }).payload)}
              >
                <LabelList
                  dataKey="Company"
                  content={(props) => {
                    const { x, y, value, index } = props as { x?: number; y?: number; value?: string; index?: number };
                    const row = index === undefined ? undefined : data[index];
                    if (!row || !labelled.has(row.company_id) || x === undefined || y === undefined) return null;
                    const onRight = row.x < xLow + (xHigh - xLow) * 0.8;
                    return (
                      <text
                        x={Number(x) + (onRight ? 11 : -11)}
                        y={Number(y)}
                        dy="0.32em"
                        textAnchor={onRight ? "start" : "end"}
                        className="fill-foreground text-xs font-medium"
                        stroke="var(--background)"
                        strokeWidth={3}
                        paintOrder="stroke"
                        pointerEvents="none"
                      >
                        {value}
                      </text>
                    );
                  }}
                />
              </Scatter>
            ))}
          </ScatterChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        Deals with the same score and urgency are spread slightly so none hides another; the tooltip shows the exact
        values. The highest-priority deals are labelled where there is room.
      </CardFooter>
    </Card>
  );
}
