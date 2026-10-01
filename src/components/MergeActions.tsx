"use client";

import { Ban, CircleCheck } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { approveMergeAction, rejectMergeAction } from "@/lib/crm/actions";

import { ErrorLine } from "./ReplyDialogs";
import { useAction } from "./useAction";

export function MergeActions({ suggestionId, skipHref }: { suggestionId: number; skipHref: string }) {
  const { run, pending, error } = useAction();
  return (
    <>
      <div className="my-2.5 flex flex-wrap gap-2.5">
        <Button size="lg" disabled={pending} onClick={() => run(() => approveMergeAction(suggestionId))}>
          <CircleCheck aria-hidden="true" /> Same company, merge
        </Button>
        <Button size="lg" variant="outline" disabled={pending} onClick={() => run(() => rejectMergeAction(suggestionId))}>
          <Ban aria-hidden="true" /> Different companies
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link href={skipHref}>Skip</Link>
        </Button>
      </div>
      <ErrorLine error={error} />
    </>
  );
}
