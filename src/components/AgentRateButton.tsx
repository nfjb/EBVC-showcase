"use client";

/**
 * "Rate with the Fathom agent": the only way the live (OpenAI) agent starts. Shown when an
 * upload left companies the pre-rated demo file does not cover.
 */

import { Bot } from "lucide-react";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { agentStatus, startAgentRating, subscribeAgentStatus, unratedInputs } from "@/lib/crm/agent";

import { useCrm } from "./useCrm";

export function AgentRateButton() {
  useCrm();
  const status = useSyncExternalStore(subscribeAgentStatus, agentStatus, agentStatus);
  const unrated = unratedInputs().length;
  if (!unrated || status.state === "running") return null;
  return (
    <Card className="my-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="size-4 text-primary" aria-hidden="true" /> {unrated} deals are not rated yet
        </CardTitle>
        <CardDescription>
          They are not in the pre-rated demo data. The Fathom agent rates them with OpenAI, which uses your API credits.
        </CardDescription>
        <CardAction>
          <Button onClick={() => void startAgentRating()}>
            <Bot aria-hidden="true" /> Rate with the Fathom agent
          </Button>
        </CardAction>
      </CardHeader>
    </Card>
  );
}
