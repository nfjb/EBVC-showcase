"use client";

/**
 * Render the pages only in the browser: the CRM is in this tab's memory, so the server has
 * nothing to render them from.
 */

import { Suspense, useSyncExternalStore, type ReactNode } from "react";

const noop = () => () => {};

export function BrowserOnly({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  if (!mounted) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>{children}</Suspense>;
}
