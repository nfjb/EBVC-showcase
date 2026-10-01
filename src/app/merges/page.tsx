"use client";

/**
 * Merge queue: companies with very similar names and no conflicting website. Nothing is
 * merged until a person decides.
 */

import { MergeActions } from "@/components/MergeActions";
import { Caption, Notice, PageTitle } from "@/components/page";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useCrm, useSearchRecord } from "@/components/useCrm";
import * as repo from "@/lib/db/repository";
import { withQuery } from "@/lib/routes";
import { longDate } from "@/lib/triage/dates";
import { CHANNEL_LABELS, label } from "@/lib/triage/labels";
import { pyFixed } from "@/lib/triage/py";
import type { Company } from "@/lib/triage/types";

function CompanyCard({ company }: { company: Company }) {
  const touchpoints = repo.touchpointsOf(company.id);
  return (
    <Card>
      <CardContent>
        <p className="mb-2">
          <strong>{company.name}</strong>
          <br />
          {company.website_domain || "no website"} · {company.country}
        </p>
        {touchpoints.map((touchpoint) => {
          const identifiers =
            [touchpoint.website, touchpoint.founder_email, touchpoint.founder_linkedin]
              .filter((value) => value)
              .join(" · ") || "no website, email or LinkedIn";
          return (
            <p key={touchpoint.id} className="my-1 text-sm text-muted-foreground">
              {longDate(touchpoint.received_at)} · {label(CHANNEL_LABELS, touchpoint.channel)} to {touchpoint.recipient}{" "}
              as “{touchpoint.company_name}” · {identifiers}
            </p>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function MergeQueuePage() {
  useCrm();
  const params = useSearchRecord();
  const requested = Number(params.pair) || 0;
  const pending = repo.listMergeSuggestions("pending");
  return (
    <>
      <PageTitle>Merge queue</PageTitle>
      <Caption>
        These companies have very similar names and no conflicting website. Nothing is merged until a person decides.
      </Caption>
      {!pending.length ? (
        <Notice tone="success">No possible duplicates waiting.</Notice>
      ) : (
        <MergePair pending={pending} position={Math.max(0, Math.min(requested, pending.length - 1))} />
      )}
    </>
  );
}

function MergePair({ pending, position }: { pending: ReturnType<typeof repo.listMergeSuggestions>; position: number }) {
  const suggestion = pending[position];
  const company = repo.getCompany(suggestion.company_id)!;
  const candidate = repo.getCompany(suggestion.candidate_id)!;
  return (
    <>
      <Caption className="mb-0">
        Pair {position + 1} of {pending.length}
      </Caption>
      <Progress
        value={((position + 1) / pending.length) * 100}
        aria-label={`Pair ${position + 1} of ${pending.length}`}
        className="mt-1.5 mb-3.5 h-2 bg-muted"
      />
      <p>
        Name similarity <strong>{pyFixed(suggestion.similarity, 2)}</strong> after removing legal suffixes and words
        like “AI” or “Labs”. Is this the same company?
      </p>
      <div className="grid gap-5 md:grid-cols-2">
        <CompanyCard company={company} />
        <CompanyCard company={candidate} />
      </div>
      <MergeActions
        key={suggestion.id}
        suggestionId={suggestion.id}
        skipHref={withQuery("/merges", { pair: (position + 1) % pending.length })}
      />
    </>
  );
}
