"use client";

import Link from "next/link";

import { approveMergeAction, rejectMergeAction } from "@/app/actions";

import { ErrorLine } from "./ReplyDialogs";
import { useAction } from "./useAction";

export function MergeActions({ suggestionId, skipHref }: { suggestionId: number; skipHref: string }) {
  const { run, pending, error } = useAction();
  return (
    <>
      <div className="button-row">
        <button
          type="button"
          className="button primary"
          disabled={pending}
          onClick={() => run(() => approveMergeAction(suggestionId))}
        >
          ✅ Same company, merge
        </button>
        <button type="button" className="button" disabled={pending} onClick={() => run(() => rejectMergeAction(suggestionId))}>
          ⛔ Different companies
        </button>
        <Link className="button" href={skipHref}>
          Skip
        </Link>
      </div>
      <ErrorLine error={error} />
    </>
  );
}
