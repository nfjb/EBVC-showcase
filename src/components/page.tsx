/**
 * Page building blocks shared by every page, all made of shadcn/ui components: the page
 * header, captions, status notices, stat cards, empty states and the bordered table. Status
 * is always written out; the icon and the colour only reinforce the words.
 */

import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** The title block of a page: an optional overline, the title, a description and actions. */
export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 space-y-1">
        {eyebrow ? <p className="text-sm font-medium text-primary">{eyebrow}</p> : null}
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {description ? <p className="max-w-3xl text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-end gap-2 print:hidden">{actions}</div> : null}
    </header>
  );
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
    <Alert variant={tone} role={tone === "error" ? "alert" : "status"} className={cn("my-3", className)}>
      <Icon aria-hidden="true" />
      <AlertDescription className="text-current">{children}</AlertDescription>
    </Alert>
  );
}

/** A row of stat cards. */
export function Metrics({ children }: { children: ReactNode }) {
  return <div className="my-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">{children}</div>;
}

export function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card className="gap-1 py-3">
      <CardHeader className="px-4">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

/** Nothing to show yet: an icon, a title, a sentence and an optional next step. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}

/** A bordered table; ``tall`` scrolls inside a fixed height with a sticky header. */
export function DataTable({ tall = false, children }: { tall?: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-card [&_th]:bg-muted/50",
        tall &&
          "[&>[data-slot=table-container]]:max-h-[520px] [&>[data-slot=table-container]]:overflow-y-auto [&_th]:sticky [&_th]:top-0 [&_th]:z-10",
      )}
    >
      <Table>{children}</Table>
    </div>
  );
}

/** The class for a numeric column (right-aligned, tabular figures). */
export const NUM = "text-right tabular-nums";
