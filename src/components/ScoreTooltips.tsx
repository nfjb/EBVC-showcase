"use client";

/**
 * The two scores with their explanation on hover: the Urgency Score with its reason, the
 * Quality Score with its Fathom breakdown, and both column headers with the rule.
 */

import { ArrowDown, ArrowUp, ArrowUpDown, Info } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

import { ScoreHint } from "./ScoreHint";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { loadTriageConfig } from "@/lib/triage/config";
import { pyFixed } from "@/lib/triage/py";
import { FATHOM_DIMENSIONS, ratedCount, ratingsOf, scoreBand, scoreCompany } from "@/lib/triage/scoring";
import type { SortColumn, SortState } from "@/lib/triage/sorting";
import { urgencyRule, urgencySummary, type UrgencyBreakdown } from "@/lib/triage/urgency";
import { cn } from "@/lib/utils";

export function UrgencyValue({ breakdown, hot = false }: { breakdown: UrgencyBreakdown; hot?: boolean }) {
  return (
    <ScoreHint
      label={`Urgency Score ${urgencySummary(breakdown)}`}
      className={cn(
        "cursor-help underline decoration-muted-foreground/40 decoration-dotted underline-offset-4",
        hot && "font-bold text-hot",
      )}
      contentClassName="w-96"
      trigger={breakdown.score}
    >
      <div className="mb-1.5 font-semibold">
        {breakdown.score}/100{" "}
        <span className="font-normal opacity-70">
          (raw {breakdown.raw}/{breakdown.max_raw})
        </span>{" "}
        · {breakdown.tier.label}
      </div>
      <table className="w-full tabular-nums">
        <tbody>
          {breakdown.rows.map((row) => (
            <tr key={row.dimension} className="align-top">
              <td className="py-0.5 pr-3">
                <div className="whitespace-nowrap">{row.label}</div>
                <div className="opacity-70">{row.note}</div>
              </td>
              <td className="py-0.5 text-right font-medium whitespace-nowrap">
                {row.points}
                <span className="font-normal opacity-60">/{row.max}</span>
              </td>
            </tr>
          ))}
          <tr className="border-t border-border">
            <td className="pt-1 font-semibold">Raw sum → Urgency Score</td>
            <td className="pt-1 text-right font-semibold whitespace-nowrap">
              {breakdown.raw} → {breakdown.score}
            </td>
          </tr>
        </tbody>
      </table>
      <div className="mt-1.5 opacity-80">{breakdown.tier.action}</div>
    </ScoreHint>
  );
}

/** The Quality Score (Fathom rating) with its breakdown on hover, one dimension per line. */
export function QualityValue({ company }: { company: object }) {
  const { fathom } = loadTriageConfig();
  const ratings = ratingsOf(company);
  const rated = ratedCount(company);
  const [score, breakdown] = scoreCompany(ratings, fathom);
  const band = scoreBand(score, rated, fathom);
  const source = (company as { rating_source?: string }).rating_source;
  const labels: Record<string, string> = {
    ...Object.fromEntries(FATHOM_DIMENSIONS.map((dimension) => [dimension.key, dimension.label])),
    storytelling_bonus: "Storytelling bonus",
  };
  if (!rated) {
    return (
      <span className="text-muted-foreground" aria-label="Quality Score: not rated yet">
        –
      </span>
    );
  }
  return (
    <ScoreHint
      label={`Quality Score ${pyFixed(score, 0)} %: ${band}`}
      className="cursor-help underline decoration-muted-foreground/40 decoration-dotted underline-offset-4"
      contentClassName="w-80"
      trigger={`${pyFixed(score, 0)} %`}
    >
      <div className="mb-1.5 font-semibold">
        {pyFixed(score, 1)} % · {band}
      </div>
      <table className="w-full tabular-nums">
        <tbody>
          {breakdown.map((row) => (
            <tr key={row.component}>
              <td className="py-px pr-3 whitespace-nowrap">{labels[row.component]}</td>
              <td className="py-px pr-3 text-right whitespace-nowrap opacity-70">
                {row.value === null
                  ? "–"
                  : row.weight
                    ? `${row.value}/${fathom.scale_max} × ${row.weight} %`
                    : `+${row.value}`}
              </td>
              <td className="py-px text-right font-medium whitespace-nowrap">{pyFixed(row.points, 1)}</td>
            </tr>
          ))}
          <tr className="border-t border-border">
            <td className="pt-1 font-semibold" colSpan={2}>
              Quality Score
            </td>
            <td className="pt-1 text-right font-semibold">{pyFixed(score, 1)}</td>
          </tr>
        </tbody>
      </table>
      <div className="mt-1.5 opacity-80">
        {source === "person" ? "Ratings set by a person." : source === "agent" ? "Rated by the Fathom agent." : ""}
      </div>
    </ScoreHint>
  );
}

// ── sortable column headers ──────────────────────────────────────────────────────

export { ariaSort, nextSort, readSort, sortByScore, type SortColumn, type SortState } from "@/lib/triage/sorting";

function ScoreHeader({
  label,
  column,
  sort,
  sortHref,
  infoHref,
  info,
}: {
  label: string;
  column: SortColumn;
  sort: SortState;
  sortHref: string;
  infoHref: string;
  info: ReactNode;
}) {
  // No explicit sort is the priority order, which is the Attention Score, descending.
  const active = (sort.column ?? "attention") === column;
  const Arrow = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <span className="inline-flex items-center gap-0.5">
      <Button variant="ghost" size="sm" className="-mr-1 h-auto px-1.5 py-1 font-medium" asChild>
        <Link
          href={sortHref}
          scroll={false}
          aria-label={`Sort by ${label}${active ? (sort.direction === "asc" ? ", now ascending" : ", now descending") : ""}`}
        >
          {/* Two lines ("Quality" over "Score") keep the number columns narrow. */}
          <span className="flex flex-col items-end leading-tight">
            <span>{label.split(" ")[0]}</span>
            <span className="text-xs font-normal text-muted-foreground">{label.split(" ").slice(1).join(" ")}</span>
          </span>
          <Arrow className={cn("size-3.5", !active && "text-muted-foreground/60")} aria-hidden="true" />
        </Link>
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={infoHref}
            className="text-muted-foreground hover:text-foreground"
            aria-label={`How the ${label} works`}
          >
            <Info className="size-3.5" aria-hidden="true" />
          </Link>
        </TooltipTrigger>
        <TooltipContent className="block max-w-80 font-normal">{info} Click for the full explanation.</TooltipContent>
      </Tooltip>
    </span>
  );
}

export function QualityHeader({ sort, sortHref }: { sort: SortState; sortHref: string }) {
  const { fathom } = loadTriageConfig();
  const weights = FATHOM_DIMENSIONS.map((dimension) => `${dimension.label} ${fathom.weights[dimension.key]} %`).join(
    ", ",
  );
  return (
    <ScoreHeader
      label="Quality Score"
      column="quality"
      sort={sort}
      sortHref={sortHref}
      infoHref="/scoring#quality"
      info={`The Fathom rating: ten dimensions, each rated 1–${fathom.scale_max} and weighted (${weights}). Score = sum of weight × rating / ${fathom.scale_max}, plus up to ${fathom.storytelling_bonus_max} storytelling bonus points, capped at 100.`}
    />
  );
}

export function UrgencyHeader({ sort, sortHref }: { sort: SortState; sortHref: string }) {
  return (
    <ScoreHeader
      label="Urgency Score"
      column="urgency"
      sort={sort}
      sortHref={sortHref}
      infoHref="/scoring#urgency"
      info={urgencyRule()}
    />
  );
}

export function AttentionHeader({ sort, sortHref }: { sort: SortState; sortHref: string }) {
  return (
    <ScoreHeader
      label="Attention Score"
      column="attention"
      sort={sort}
      sortHref={sortHref}
      infoHref="/scoring#priority"
      info="Quality Score × Urgency Score / 100: which deal needs attention first; every worklist is ordered by it. A deal that is both strong and pressing scores highest."
    />
  );
}

/** The Attention Score (the priority) with its calculation on hover. */
export function AttentionValue({
  quality,
  urgency,
  attention,
}: {
  quality: number;
  urgency: number;
  attention: number;
}) {
  const text = `${quality} % × ${urgency} / 100 = ${pyFixed(attention, 1)}`;
  return (
    <ScoreHint
      label={`Attention Score ${pyFixed(attention, 1)}: ${text}`}
      className="cursor-help font-semibold underline decoration-muted-foreground/40 decoration-dotted underline-offset-4"
      trigger={pyFixed(attention, 1)}
    >
      Quality Score × Urgency Score / 100
      <br />
      {text}
    </ScoreHint>
  );
}
