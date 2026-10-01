"use client";

/**
 * Render the pages only in the browser: the CRM is in this tab's memory, so the server has
 * nothing to render them from. A skeleton stands in until then.
 */

import { Suspense, useSyncExternalStore, type ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";

const noop = () => () => {};

export function useMounted(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}

export function BrowserOnly({ children }: { children: ReactNode }) {
  if (!useMounted()) return <PageSkeleton />;
  return <Suspense fallback={<PageSkeleton />}>{children}</Suspense>;
}
