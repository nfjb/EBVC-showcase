"use client";

/** The Fathom agent's progress while it rates new deals in the background, on every page. */

import { Bot, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { Notice } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { agentStatus, startAgentRating, subscribeAgentStatus } from "@/lib/crm/agent";

export function AgentStatusBar() {
  const status = useSyncExternalStore(subscribeAgentStatus, agentStatus, agentStatus);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const key = `${status.state}-${status.total}`;
  if (status.state === "idle" || dismissed === key) return null;

  if (status.state === "running") {
    return (
      <div className="mb-4 rounded-lg border bg-card px-3 py-2 print:hidden" role="status">
        <div className="flex items-center gap-2 text-sm">
          <Bot className="size-4 text-primary" aria-hidden="true" />
          Fathom agent is rating new deals: {status.done} of {status.total} done.
        </div>
        <Progress value={(status.done / status.total) * 100} className="mt-2 h-1.5 bg-muted" aria-hidden="true" />
      </div>
    );
  }
  if (status.state === "error") {
    return (
      <div className="print:hidden">
        <Notice tone="error">
          <span>
            The Fathom agent could not rate {status.total - status.done} deals: {status.error}{" "}
          </span>
          <span className="mt-1.5 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void startAgentRating()}>
              Try again
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDismissed(key)}>
              Dismiss
            </Button>
          </span>
        </Notice>
      </div>
    );
  }
  return (
    <div className="print:hidden">
      <Notice tone="success">
        <span className="flex items-center gap-2">
          Fathom agent rated {status.total} deals. Every rating can be changed on the deal page.
          <Button size="icon-sm" variant="ghost" className="ml-auto" onClick={() => setDismissed(key)} aria-label="Dismiss">
            <X />
          </Button>
        </span>
      </Notice>
    </div>
  );
}
