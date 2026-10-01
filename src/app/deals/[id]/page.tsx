"use client";

/** Deal detail: one company — decide, see why it scores what it does, its history, pin its rank. */

import { Ban, Hourglass } from "lucide-react";
import { redirect, useParams } from "next/navigation";

import { DecideSection, RankOverrideForm } from "@/components/DealForms";
import { DealNavBar, DealPosition, RankMetric } from "@/components/DealNav";
import { Caption, DataTable, Eyebrow, Metric, Metrics, Notice, NUM, PageTitle } from "@/components/page";
import { Tabs } from "@/components/Tabs";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCrm, useSearchRecord } from "@/components/useCrm";
import * as repo from "@/lib/db/repository";
import { pageNameFor, safeReturnHref, withQuery } from "@/lib/routes";
import { introducerThanksDialogData, introReplyDialogData, passDialogData } from "@/lib/crm/dialogData";
import { daysInQueue, rankWorklist } from "@/lib/crm/triageActions";
import { compareCodePoints, pyFixed } from "@/lib/triage/py";
import { loadTriageConfig } from "@/lib/triage/config";
import {
  CHANNEL_LABELS,
  DECISION_LABELS,
  euros,
  INTRO_LABELS,
  label,
  PASS_CODE_LABELS,
  rating,
} from "@/lib/triage/labels";
import { O1_DIMENSIONS, queueFlag, ratedCount, ratingsOf, scoreBand, type BreakdownRow } from "@/lib/triage/scoring";

import { EmptyCrm } from "../EmptyCrm";

const DIMENSION_LABELS: Record<string, string> = {
  ...Object.fromEntries(O1_DIMENSIONS.map((dimension) => [dimension.key, dimension.label])),
  storytelling_bonus: "Storytelling & design",
};

export default function DealDetailPage() {
  useCrm();
  const { id } = useParams<{ id: string }>();
  const search = useSearchRecord();
  const from = safeReturnHref(search.from);
  const companies = repo.listCompaniesWithTouchpoints();
  if (!companies.length) return <EmptyCrm />;
  const company = companies.find((candidate) => candidate.id === Number(id));
  // Merged away or re-uploaded: open the top of the list instead.
  if (!company) redirect(withQuery("/deals", { from }));

  const waiting = daysInQueue(company);
  const flag = queueFlag(waiting, loadTriageConfig().queue_flags);
  const fallback = { title: "Team top 20", ids: rankWorklist(companies).slice(0, 20).map((item) => item.id) };
  const history = repo.touchpointsOf(company.id);
  const latestIntro = [...history].reverse().find((touchpoint) => touchpoint.channel === "warm_intro") ?? null;
  const breakdown = JSON.parse(company.score_breakdown || "[]") as BreakdownRow[];
  const returnLabel = pageNameFor(from);

  return (
    <DealPosition companyId={company.id} known={companies.map((item) => item.id)} fallback={fallback}>
      <DealNavBar
        returnHref={from}
        returnLabel={returnLabel}
        deals={[...companies]
          .sort((a, b) => compareCodePoints(a.name.toLowerCase(), b.name.toLowerCase()))
          .map((item) => ({ id: item.id, name: item.name, domain: item.website_domain }))}
      />

      <Eyebrow>Deal detail</Eyebrow>
      <PageTitle>{company.name}</PageTitle>
      <p>
        {company.one_liner}
        <br />
        {company.stage} · {euros(company.round_size_eur)} round · {company.country} · owner{" "}
        <strong>{company.owner}</strong> · {company.website_domain || "no website"}
      </p>

      <Metrics>
        <Metric label="Decision" value={label(DECISION_LABELS, company.status)} />
        <RankMetric />
        <Metric label="O1 score" value={`${pyFixed(company.score, 1)} %`} />
        <Metric label="Days in queue" value={waiting} />
        <Metric label="Touchpoints" value={company.touchpoint_count} />
      </Metrics>
      {flag ? (
        <Notice tone="warning">
          <span className="inline-flex items-center gap-1.5">
            <Hourglass className="size-4" aria-hidden="true" /> {flag} — {waiting} days in the queue.
          </span>
        </Notice>
      ) : null}
      {!company.passed_hard_filters ? (
        <Notice tone="info">
          <span className="inline-flex items-center gap-1.5">
            <Ban className="size-4" aria-hidden="true" /> Failed the hard filters:{" "}
            {label(PASS_CODE_LABELS, company.pass_code)}.
          </span>
        </Notice>
      ) : null}
      <p className="text-sm">
        <span className="text-muted-foreground">O1 assessment:</span>{" "}
        <strong>{scoreBand(company.score, ratedCount(company), loadTriageConfig().o1)}</strong>
      </p>
      {company.latest_signal ? <Caption>Latest signal: {company.latest_signal}</Caption> : null}

      <Tabs labels={["Decide", "Score breakdown", `History (${company.touchpoint_count})`, "Rank override"]}>
        <DecideSection
          data={{
            companyId: company.id,
            status: company.status,
            statusLabel: label(DECISION_LABELS, company.status),
            ratings: ratingsOf(company),
            pass: passDialogData(company),
            introReply:
              latestIntro && latestIntro.intro_status === "open" ? introReplyDialogData(latestIntro, company) : null,
            introducerThanks: latestIntro ? introducerThanksDialogData(latestIntro, company) : null,
            sentCount: repo.countOutboxMessagesOf(company.id),
          }}
        />

        <div>
          {breakdown.length ? (
            <DataTable>
              <TableHeader>
                <TableRow>
                  <TableHead>O1 dimension</TableHead>
                  <TableHead className={NUM}>Rating</TableHead>
                  <TableHead className={NUM}>Weight</TableHead>
                  <TableHead className={NUM}>Points (%)</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakdown.map((row) => (
                  <TableRow key={row.component}>
                    <TableCell>{DIMENSION_LABELS[row.component] ?? row.component}</TableCell>
                    <TableCell className={NUM}>{rating(row.value)}</TableCell>
                    <TableCell className={NUM}>{row.weight ? `${row.weight} %` : "bonus"}</TableCell>
                    <TableCell className={NUM}>{pyFixed(row.points, 1)}</TableCell>
                    <TableCell className="whitespace-normal">{row.note}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold hover:bg-transparent">
                  <TableCell>O1 score</TableCell>
                  <TableCell />
                  <TableCell className={NUM}>100 %</TableCell>
                  <TableCell className={NUM}>{pyFixed(company.score, 1)}</TableCell>
                  <TableCell className="whitespace-normal">Capped at 100 %</TableCell>
                </TableRow>
              </TableBody>
            </DataTable>
          ) : null}
          <Caption>
            Points = weight × rating / {loadTriageConfig().o1.scale_max}. Every rating is a person&apos;s; unrated dimensions
            add nothing. Time in queue is not part of the score.
          </Caption>
        </div>

        <DataTable>
          <TableHeader>
            <TableRow>
              <TableHead>Received</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Sent to</TableHead>
              <TableHead>Name used</TableHead>
              <TableHead>Website</TableHead>
              <TableHead>Introducer</TableHead>
              <TableHead>Intro status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((touchpoint) => (
              <TableRow key={touchpoint.id}>
                <TableCell>{touchpoint.received_at}</TableCell>
                <TableCell>{label(CHANNEL_LABELS, touchpoint.channel)}</TableCell>
                <TableCell>{touchpoint.recipient}</TableCell>
                <TableCell>{touchpoint.company_name}</TableCell>
                <TableCell>{touchpoint.website}</TableCell>
                <TableCell>{touchpoint.introducer_name}</TableCell>
                <TableCell>{INTRO_LABELS[touchpoint.intro_status] ?? ""}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </DataTable>

        <RankOverrideForm key={company.rank_override ?? 0} companyId={company.id} current={company.rank_override} />
      </Tabs>
    </DealPosition>
  );
}
