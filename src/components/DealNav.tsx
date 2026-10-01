"use client";

/**
 * Deal detail navigation: back to the page the deal was opened from, where it sits in that
 * page's list ("3 of 20"), previous / next through the list, and a jump-to search.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { dealHref } from "@/lib/routes";

import { readDealList, readLastDeal, rememberLastDeal, type RememberedList } from "./dealList";

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
    <div className="deal-nav no-print">
      <Link className="button" href={returnHref} title={`Back to ${returnLabel}`}>
        ← {returnLabel}
      </Link>
      <div className="crumb">
        {returnLabel} › {position?.title ?? "…"} · <b>{where}</b>
      </div>
      {previousId !== null ? (
        <Link className="button" href={dealHref(previousId, returnHref)} title={byId.get(previousId)?.name}>
          ‹ Previous
        </Link>
      ) : (
        <button type="button" className="button" disabled>
          ‹ Previous
        </button>
      )}
      {nextId !== null ? (
        <Link className="button" href={dealHref(nextId, returnHref)} title={byId.get(nextId)?.name}>
          Next ›
        </Link>
      ) : (
        <button type="button" className="button" disabled>
          Next ›
        </button>
      )}
      <select
        aria-label="Jump to a deal"
        value=""
        onChange={(event) => {
          const id = Number(event.target.value);
          if (id) router.push(dealHref(id, returnHref));
        }}
      >
        <option value="">Jump to a deal…</option>
        {deals.map((deal) => (
          <option key={deal.id} value={deal.id}>
            {deal.name} · {deal.domain || "no website"}
          </option>
        ))}
      </select>
    </div>
  );
}

/** "Rank in <list>" — the deal's position in the list it was opened from. */
export function RankMetric() {
  const position = useContext(PositionContext);
  return (
    <div>
      <div className="metric-label">Rank in {position?.title ?? "list"}</div>
      <div className="metric-value">{position && position.index !== null ? `#${position.index + 1}` : "–"}</div>
    </div>
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
  return <p className="caption">Opening the deal…</p>;
}
