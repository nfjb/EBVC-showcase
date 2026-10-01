"use client";

/**
 * The CRM lives in this browser tab (``src/lib/db/connection.ts``). These hooks re-render a
 * page whenever a click or an upload changes it, or a different team member is chosen.
 */

import { useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";

import { actingMember, subscribeActingMember } from "@/lib/crm/person";
import { loadDemoIfEmpty } from "@/lib/crm/pipeline";
import { getVersion, subscribe } from "@/lib/db/connection";

// The tab opens with the demo deal flow loaded, before any page renders (browser only: the
// server never holds the CRM).
if (typeof window !== "undefined") loadDemoIfEmpty();

/** Subscribe the calling page to the store; it then reads it through ``repo`` as before. */
export function useCrm(): number {
  return useSyncExternalStore(subscribe, getVersion, getVersion);
}

export function useActingMember(): string {
  return useSyncExternalStore(subscribeActingMember, actingMember, actingMember);
}

/** The query string as ``{key: value}``, the shape the server pages used to receive. */
export function useSearchRecord(): Record<string, string> {
  return Object.fromEntries(useSearchParams().entries());
}
