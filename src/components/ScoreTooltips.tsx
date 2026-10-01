"use client";

/**
 * The two scores with their explanation on hover: the Urgency Score with its reason, the
 * Importance Score with its Fathom breakdown, and both column headers with the rule.
 */

import { ArrowDown, ArrowUp, ArrowUpDown, Info } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { loadTriageConfig } from "@/lib/triage/config";
import { pyFixed } from "@/lib/triage/py";
import { FATHOM_DIMENSIONS, ratedCount, ratingsOf, scoreBand, scoreCompany } from "@/lib/triage/scoring";
import type { SortColumn, SortState } from "@/lib/triage/sorting";
import { urgencyRule } from "@/lib/triage/urgency";
import { cn } from "@/lib/utils";

export function UrgencyValue({ value, reason, hot = false }: { value: number; reason: string; hot?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn(
            "cursor-help underline decoration-muted-foreground/40 decoration-dotted underline-offset-4",
            hot && "font-bold text-hot",
          )}
          aria-label={`Urgency Score ${value}: ${reason}`}
        >
          {value}
        </span>
      </TooltipTrigger>
      <TooltipContent side="left" className="block max-w-72">
        {reason}
      </TooltipContent>
    </Tooltip>
  );
}

/** The Importance Score (Fathom rating) with its breakdown on hover, one dimension per line. */
export function ImportanceValue({ company }: { company: object }) {
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
      <span className="text-muted-foreground" aria-label="Importance Score: not rated yet">
        –
      </span>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="cursor-help underline decoration-muted-foreground/40 decoration-dotted underline-offset-4"
          aria-label={`Importance Score ${pyFixed(score, 0)}: ${band}`}
        >
          {pyFixed(score, 0)}
        </span>
      </TooltipTrigger>
      <TooltipContent side="left" className="block w-80 max-w-none p-3">
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
            <tr className="border-t border-background/30">
              <td className="pt-1 font-semibold" colSpan={2}>
                Importance Score
              </td>
              <td className="pt-1 text-right font-semibold">{pyFixed(score, 1)}</td>
            </tr>
          </tbody>
        </table>
        <div className="mt-1.5 opacity-80">
          {source === "person" ? "Ratings set by a person." : source === "agent" ? "Rated by the Fathom agent." : ""}
        </div>
      </TooltipContent>
    </Tooltip>
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
  // No explicit sort is the priority order, which is the Total Score, descending.
  const active = (sort.column ?? "total") === column;
  const Arrow = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <span className="inline-flex items-center gap-0.5">
      <Button variant="ghost" size="sm" className="-mr-1 h-7 px-1.5 font-medium" asChild>
        <Link
          href={sortHref}
          scroll={false}
          aria-label={`Sort by ${label}${active ? (sort.direction === "asc" ? ", now ascending" : ", now descending") : ""}`}
        >
          {label}
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

export function ImportanceHeader({ sort, sortHref }: { sort: SortState; sortHref: string }) {
  const { fathom } = loadTriageConfig();
  const weights = FATHOM_DIMENSIONS.map((dimension) => `${dimension.label} ${fathom.weights[dimension.key]} %`).join(
    ", ",
  );
  return (
    <ScoreHeader
      label="Importance Score"
      column="importance"
      sort={sort}
      sortHref={sortHref}
      infoHref="/scoring#importance"
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

export function TotalHeader({ sort, sortHref }: { sort: SortState; sortHref: string }) {
  return (
    <ScoreHeader
      label="Total Score"
      column="total"
      sort={sort}
      sortHref={sortHref}
      infoHref="/scoring#priority"
      info="Importance Score × Urgency Score / 100: the priority every worklist is ordered by. A deal that is both strong and pressing scores highest."
    />
  );
}

/** The Total Score (priority) with its calculation on hover. */
export function TotalValue({ importance, urgency, total }: { importance: number; urgency: number; total: number }) {
  const text = `${importance} × ${urgency} / 100 = ${pyFixed(total, 1)}`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="cursor-help font-semibold underline decoration-muted-foreground/40 decoration-dotted underline-offset-4"
          aria-label={`Total Score ${pyFixed(total, 1)}: ${text}`}
        >
          {pyFixed(total, 1)}
        </span>
      </TooltipTrigger>
      <TooltipContent side="left" className="block">
        Importance Score × Urgency Score / 100
        <br />
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
