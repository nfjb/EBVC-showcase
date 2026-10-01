"use client";

import { Ellipsis } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setIntroStatusAction } from "@/lib/crm/actions";

import { ErrorLine } from "./ReplyDialogs";
import { useAction } from "./useAction";

/** "⋯" on an intro card: mark it replied outside the app, or close it without a reply. */
export function IntroMoreActions({ introId }: { introId: number }) {
  const { run, pending, error } = useAction();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-lg" aria-label="More actions" title="More actions">
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuItem disabled={pending} onSelect={() => run(() => setIntroStatusAction(introId, "replied"))}>
            Replied outside the app
          </DropdownMenuItem>
          <DropdownMenuItem disabled={pending} onSelect={() => run(() => setIntroStatusAction(introId, "closed"))}>
            Close without reply
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ErrorLine error={error} />
    </>
  );
}
