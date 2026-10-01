/**
 * Page building blocks shared by every page: headings in the Skarv type (Anton for display,
 * Inter for text), captions, status notices and metrics. Status is always written out; the
 * icon and the colour only reinforce the words.
 */

import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function Display({ size = "large", children }: { size?: "huge" | "large"; children: ReactNode }) {
  return (
    <h1
      className={cn(
        "m-0 font-display leading-[0.95] font-normal tracking-[0.01em] uppercase",
        size === "huge" ? "text-[clamp(40px,6vw,76px)]" : "text-5xl md:text-[56px]",
      )}
    >
      {children}
    </h1>
  );
}

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="mb-1.5 text-3xl leading-tight font-bold md:text-4xl">{children}</h1>;
}

/** The small red line above a title ("Deal detail", "Score × urgency"). */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="mt-2 text-[13px] font-semibold tracking-[0.18em] text-primary uppercase">{children}</div>;
}

export function Lede({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-lg text-muted-foreground italic">{children}</p>;
}

export function Caption({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("my-2 text-sm text-muted-foreground", className)}>{children}</p>;
}

const NOTICE_ICONS = {
  success: CircleCheck,
  info: Info,
  warning: TriangleAlert,
  error: CircleAlert,
} as const;

/** A coloured status line. ``error`` is announced at once; the others politely. */
export function Notice({
  tone,
  children,
  className,
}: {
  tone: keyof typeof NOTICE_ICONS;
  children: ReactNode;
  className?: string;
}) {
  const Icon = NOTICE_ICONS[tone];
  return (
    <Alert variant={tone} role={tone === "error" ? "alert" : "status"} className={cn("my-2.5", className)}>
      <Icon aria-hidden="true" />
      <AlertDescription className="text-current">{children}</AlertDescription>
    </Alert>
  );
}

export function Metrics({ children }: { children: ReactNode }) {
  return <div className="my-4 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">{children}</div>;
}

export function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-3xl leading-tight font-semibold tabular-nums">{value}</div>
    </div>
  );
}

/** A bordered table on white; ``tall`` scrolls inside a fixed height with a sticky header. */
export function DataTable({ tall = false, children }: { tall?: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-card [&_th]:bg-muted/50",
        tall && "[&>[data-slot=table-container]]:max-h-[520px] [&>[data-slot=table-container]]:overflow-y-auto [&_th]:sticky [&_th]:top-0",
      )}
    >
      <Table>{children}</Table>
    </div>
  );
}

/** The class for a numeric column (right-aligned, tabular figures). */
export const NUM = "text-right tabular-nums";
