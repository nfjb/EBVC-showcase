/** Deal detail with no deal chosen: open the last deal viewed, else the top of the current list. */

import { DealRedirect } from "@/components/DealNav";
import * as repo from "@/lib/db/repository";
import { safeReturnHref } from "@/lib/routes";
import { rankWorklist } from "@/lib/server/triageActions";

import { EmptyCrm } from "./EmptyCrm";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DealsPage({ searchParams }: { searchParams: SearchParams }) {
  const search = await searchParams;
  const companies = repo.listCompaniesWithTouchpoints();
  if (!companies.length) return <EmptyCrm />;
  const from = safeReturnHref(Array.isArray(search.from) ? search.from[0] : search.from);
  return (
    <DealRedirect
      known={companies.map((company) => company.id)}
      fallback={{ title: "Team top 20", ids: rankWorklist(companies).slice(0, 20).map((company) => company.id) }}
      returnHref={from}
    />
  );
}
