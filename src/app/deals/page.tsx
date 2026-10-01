"use client";

/** Deal detail with no deal chosen: open the last deal viewed, else the top of the current list. */

import { DealRedirect } from "@/components/DealNav";
import { useCrm, useSearchRecord } from "@/components/useCrm";
import * as repo from "@/lib/db/repository";
import { safeReturnHref } from "@/lib/routes";
import { rankWorklist } from "@/lib/crm/triageActions";

import { EmptyCrm } from "./EmptyCrm";

export default function DealsPage() {
  useCrm();
  const search = useSearchRecord();
  const companies = repo.listCompaniesWithTouchpoints();
  if (!companies.length) return <EmptyCrm />;
  const from = safeReturnHref(search.from);
  return (
    <DealRedirect
      known={companies.map((company) => company.id)}
      fallback={{ title: "Team top 20", ids: rankWorklist(companies).slice(0, 20).map((company) => company.id) }}
      returnHref={from}
    />
  );
}
