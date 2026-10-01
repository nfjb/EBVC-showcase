"use client";

/** The Urgency Score with its reason on hover, and the column header with the rule. */

import { Info } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
      <TooltipContent side="left" className="max-w-72">
        {reason}
      </TooltipContent>
    </Tooltip>
  );
}

export function UrgencyHeader() {
  return (
    <span className="inline-flex items-center gap-1">
      Urgency Score
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="How the Urgency Score works">
            <Info className="size-3.5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-80 font-normal">{urgencyRule()}</TooltipContent>
      </Tooltip>
    </span>
  );
}
