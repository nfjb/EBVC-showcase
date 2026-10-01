/**
 * Merge queue: companies with very similar names and no conflicting website. Nothing is
 * merged until a person decides.
 */

import { MergeActions } from "@/components/MergeActions";
import * as repo from "@/lib/db/repository";
import { withQuery } from "@/lib/routes";
import { longDate } from "@/lib/triage/dates";
import { CHANNEL_LABELS, label } from "@/lib/triage/labels";
import { pyFixed } from "@/lib/triage/py";
import type { Company } from "@/lib/triage/types";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function CompanyCard({ company }: { company: Company }) {
  const touchpoints = repo.touchpointsOf(company.id);
  return (
    <div className="card">
      <p style={{ margin: "0 0 8px" }}>
        <strong>{company.name}</strong>
        <br />
        {company.website_domain || "no website"} · {company.country}
      </p>
      {touchpoints.map((touchpoint) => {
        const identifiers =
          [touchpoint.website, touchpoint.founder_email, touchpoint.founder_linkedin].filter((value) => value).join(" · ") ||
          "no website, email or LinkedIn";
        return (
          <p key={touchpoint.id} className="caption" style={{ margin: "4px 0" }}>
            {longDate(touchpoint.received_at)} · {label(CHANNEL_LABELS, touchpoint.channel)} to {touchpoint.recipient} as
            “{touchpoint.company_name}” · {identifiers}
          </p>
        );
      })}
    </div>
  );
}

export default async function MergeQueuePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const requested = Number(Array.isArray(params.pair) ? params.pair[0] : params.pair) || 0;
  const pending = repo.listMergeSuggestions("pending");
  return (
    <>
      <h1>Merge queue</h1>
      <p className="caption">
        These companies have very similar names and no conflicting website. Nothing is merged until a person decides.
      </p>
      {!pending.length ? (
        <div className="alert alert-success">✅ No possible duplicates waiting.</div>
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
      <p className="caption" style={{ marginBottom: 0 }}>
        Pair {position + 1} of {pending.length}
      </p>
      <div
        className="progress"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={pending.length}
        aria-valuenow={position + 1}
        aria-label={`Pair ${position + 1} of ${pending.length}`}
      >
        <span style={{ width: `${((position + 1) / pending.length) * 100}%` }} />
      </div>
      <p>
        Name similarity <strong>{pyFixed(suggestion.similarity, 2)}</strong> after removing legal suffixes and words like
        “AI” or “Labs”. Is this the same company?
      </p>
      <div className="grid-2">
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
