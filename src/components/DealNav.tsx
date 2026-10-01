"use client";

/**
 * Deal detail navigation: back to the page the deal was opened from, where it sits in that
 * page's list ("3 of 20"), previous / next through the list, and a jump-to search.
 */

import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dealHref } from "@/lib/routes";

import { readDealList, readLastDeal, rememberLastDeal, type RememberedList } from "./dealList";
import { Caption, Metric } from "./page";

interface KnownDeal {
  id: number;
  name: string;
  domain: string;
}

interface Position {
  title: string;
  sequence: number[];
  index: number | null;
}

const PositionContext = createContext<Position | null>(null);

/** The list the deal was opened from; the team worklist when there is none. */
function resolveList(remembered: RememberedList | null, known: Set<number>, fallback: RememberedList): RememberedList {
  const ids = (remembered?.ids ?? []).filter((id) => known.has(id));
  if (ids.length && remembered) return { title: remembered.title, ids };
  return fallback;
}

export function DealPosition({
  companyId,
  known,
  fallback,
  children,
}: {
  companyId: number;
  known: number[];
  fallback: RememberedList;
  children: ReactNode;
}) {
  const [position, setPosition] = useState<Position | null>(null);
  // Recomputed whenever the server re-renders with different lists (after an action, too).
  const listsKey = `${known.join(",")}|${fallback.ids.join(",")}`;
  useEffect(() => {
    rememberLastDeal(companyId);
    const list = resolveList(readDealList(), new Set(known), fallback);
    const index = list.ids.indexOf(companyId);
    setPosition({ title: list.title, sequence: list.ids, index: index >= 0 ? index : null });
  }, [companyId, listsKey]);
  return <PositionContext.Provider value={position}>{children}</PositionContext.Provider>;
}

export function DealNavBar({
  returnHref,
  returnLabel,
  deals,
}: {
  returnHref: string;
  returnLabel: string;
  /** Every deal, sorted by name, for the jump-to search. */
  deals: KnownDeal[];
}) {
  const position = useContext(PositionContext);
  const router = useRouter();
  const byId = new Map(deals.map((deal) => [deal.id, deal]));
  const index = position?.index ?? null;
  const previousId = position && index !== null && index > 0 ? position.sequence[index - 1] : null;
  const nextId = position && index !== null && index < position.sequence.length - 1 ? position.sequence[index + 1] : null;
  const where = position
    ? index !== null
      ? `${index + 1} of ${position.sequence.length}`
      : "not in this list"
    : "";

  return (
    <div className="mb-1.5 grid grid-cols-2 items-center gap-2.5 border-b pb-2.5 lg:grid-cols-[auto_minmax(0,1fr)_auto_auto_minmax(220px,320px)] print:hidden">
      <Button variant="outline" size="lg" asChild>
        <Link href={returnHref} title={`Back to ${returnLabel}`}>
          <ArrowLeft aria-hidden="true" /> {returnLabel}
        </Link>
      </Button>
      <div className="truncate text-sm text-muted-foreground">
        {returnLabel} › {position?.title ?? "…"} · <b className="text-foreground">{where}</b>
      </div>
      {previousId !== null ? (
        <Button variant="outline" size="lg" asChild>
          <Link href={dealHref(previousId, returnHref)} title={byId.get(previousId)?.name}>
            <ChevronLeft aria-hidden="true" /> Previous
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="lg" disabled>
          <ChevronLeft aria-hidden="true" /> Previous
        </Button>
      )}
      {nextId !== null ? (
        <Button variant="outline" size="lg" asChild>
          <Link href={dealHref(nextId, returnHref)} title={byId.get(nextId)?.name}>
            Next <ChevronRight aria-hidden="true" />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="lg" disabled>
          Next <ChevronRight aria-hidden="true" />
        </Button>
      )}
      <Select
        value=""
        onValueChange={(value) => {
          const id = Number(value);
          if (id) router.push(dealHref(id, returnHref));
        }}
      >
        <SelectTrigger className="h-9 w-full bg-card" aria-label="Jump to a deal">
          <SelectValue placeholder="Jump to a deal…" />
        </SelectTrigger>
        <SelectContent className="max-h-96">
          {deals.map((deal) => (
            <SelectItem key={deal.id} value={String(deal.id)}>
              {deal.name} · {deal.domain || "no website"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** "Rank in <list>" — the deal's position in the list it was opened from. */
export function RankMetric() {
  const position = useContext(PositionContext);
  return (
    <Metric
      label={`Rank in ${position?.title ?? "list"}`}
      value={position && position.index !== null ? `#${position.index + 1}` : "–"}
    />
  );
}

/** ``/deals`` with no deal chosen: the last deal opened, else the top of the current list. */
export function DealRedirect({ known, fallback, returnHref }: { known: number[]; fallback: RememberedList; returnHref: string }) {
  const router = useRouter();
  useEffect(() => {
    const knownSet = new Set(known);
    const last = readLastDeal();
    const list = resolveList(readDealList(), knownSet, fallback);
    const target = last !== null && knownSet.has(last) ? last : (list.ids[0] ?? known[0]);
    if (target !== undefined) router.replace(dealHref(target, returnHref));
  }, []);
  return <Caption>Opening the deal…</Caption>;
}
