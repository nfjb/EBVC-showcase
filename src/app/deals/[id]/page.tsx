"use client";

/** Deal detail: one company — decide, see why it scores what it does, its history, pin its rank. */

import { Ban, Bot, Hourglass } from "lucide-react";
import Link from "next/link";
import { redirect, useParams } from "next/navigation";

import { DecideSection, RankOverrideForm } from "@/components/DealForms";
import { DealNavBar, DealPosition, RankMetric } from "@/components/DealNav";
import { Caption, DataTable, Metric, Metrics, Notice, NUM, PageHeader } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/Tabs";
import { Card, CardContent } from "@/components/ui/card";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatTimestamp } from "@/lib/triage/dates";
import type { Company } from "@/lib/triage/types";
import { useCrm, useSearchRecord } from "@/components/useCrm";
import * as repo from "@/lib/db/repository";
import { pageNameFor, safeReturnHref, withQuery } from "@/lib/routes";
import { introducerThanksDialogData, introReplyDialogData, passDialogData } from "@/lib/crm/dialogData";
import { daysInQueue, rankWorklist } from "@/lib/crm/triageActions";
import { compareCodePoints, pyFixed } from "@/lib/triage/py";
import { demoToday, loadTriageConfig } from "@/lib/triage/config";
import {
  CHANNEL_LABELS,
  DECISION_LABELS,
  euros,
  INTRO_LABELS,
  label,
  PASS_CODE_LABELS,
  rating,
} from "@/lib/triage/labels";
import {
  FATHOM_DIMENSIONS,
  queueFlag,
  ratedCount,
  ratingsOf,
  scoreBand,
  type BreakdownRow,
} from "@/lib/triage/scoring";
import { buildLine, urgencySummary } from "@/lib/triage/urgency";

import { EmptyCrm } from "../EmptyCrm";

const DIMENSION_LABELS: Record<string, string> = {
  ...Object.fromEntries(FATHOM_DIMENSIONS.map((dimension) => [dimension.key, dimension.label])),
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
  const urgencyInfo = buildLine(company, demoToday()).urgency_breakdown;
  const flag = queueFlag(waiting, loadTriageConfig().queue_flags);
  const fallback = {
    title: "Team top 20",
    ids: rankWorklist(companies)
      .slice(0, 20)
      .map((item) => item.id),
  };
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

      <PageHeader
        eyebrow="Deal detail"
        title={company.name}
        description={
          <>
            {company.one_liner}
            <span className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="secondary">{company.stage}</Badge>
              <Badge variant="secondary">{euros(company.round_size_eur)} round</Badge>
              <Badge variant="secondary">{company.country}</Badge>
              <Badge variant="outline">Owner {company.owner}</Badge>
              <Badge variant="outline">{company.website_domain || "no website"}</Badge>
            </span>
          </>
        }
      />

      <Metrics>
        <Metric label="Decision" value={label(DECISION_LABELS, company.status)} />
        <RankMetric />
        <Metric
          label="Importance Score"
          value={
            <span className="flex flex-col">
              {pyFixed(company.score, 1)} %
              <span className="text-xs font-normal text-muted-foreground">
                {scoreBand(company.score, ratedCount(company), loadTriageConfig().fathom)}
              </span>
            </span>
          }
        />
        <Metric
          label="Urgency Score"
          value={
            <span className="flex flex-col">
              {urgencyInfo.score}/100
              <span className="text-xs font-normal text-muted-foreground">
                {urgencyInfo.tier.label} · raw {urgencyInfo.raw}/{urgencyInfo.max_raw}
              </span>
            </span>
          }
        />
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
      {company.latest_signal ? <Caption>Latest signal: {company.latest_signal}</Caption> : null}
      <RatingProvenance company={company} />

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

        <div className="space-y-8">
          <section aria-labelledby="importance-breakdown">
            <h3 id="importance-breakdown" className="mb-2 text-base font-semibold">
              Importance Score · {pyFixed(company.score, 1)} %
            </h3>
            {breakdown.length ? (
              <DataTable>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fathom dimension</TableHead>
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
                    <TableCell>Importance Score</TableCell>
                    <TableCell />
                    <TableCell className={NUM}>100 %</TableCell>
                    <TableCell className={NUM}>{pyFixed(company.score, 1)}</TableCell>
                    <TableCell className="whitespace-normal">Capped at 100 %</TableCell>
                  </TableRow>
                </TableBody>
              </DataTable>
            ) : null}
            <Caption>
              Points = weight × rating / {loadTriageConfig().fathom.scale_max}. Ratings come from the Fathom agent or a
              person, and a person&apos;s always win; unrated dimensions add nothing. Time in queue is not part of the
              score.
            </Caption>
          </section>

          <section aria-labelledby="urgency-breakdown">
            <h3 id="urgency-breakdown" className="mb-2 text-base font-semibold">
              Urgency Score · {urgencySummary(urgencyInfo)}
            </h3>
            <DataTable>
              <TableHeader>
                <TableRow>
                  <TableHead>Urgency dimension</TableHead>
                  <TableHead>Why</TableHead>
                  <TableHead className={NUM}>Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {urgencyInfo.rows.map((row) => (
                  <TableRow key={row.dimension}>
                    <TableCell>{row.label}</TableCell>
                    <TableCell className="whitespace-normal text-muted-foreground">{row.note}</TableCell>
                    <TableCell className={NUM}>
                      {row.points} / {row.max}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold hover:bg-transparent">
                  <TableCell>Urgency Score</TableCell>
                  <TableCell className="whitespace-normal">
                    round({urgencyInfo.raw} / {urgencyInfo.max_raw} × 100) · {urgencyInfo.tier.label}
                  </TableCell>
                  <TableCell className={NUM}>{urgencyInfo.score}</TableCell>
                </TableRow>
              </TableBody>
            </DataTable>
            <Caption>
              {urgencyInfo.tier.action} Time in queue never counts: it only raises the 14- and 21-day flags.{" "}
              <Link className="underline" href="/scoring#urgency">
                How the Urgency Score works
              </Link>
            </Caption>
          </section>
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

/** Who rated the deal on Fathom, and the agent's three-sentence justification. */
function RatingProvenance({ company }: { company: Company }) {
  if (!company.rating_source) {
    return <Notice tone="info">The Fathom agent has not rated this deal yet. You can rate it yourself below.</Notice>;
  }
  const when = company.rated_at ? ` on ${formatTimestamp(company.rated_at)} UTC` : "";
  const byAgent = company.rating_source === "agent";
  return (
    <Card className="my-3">
      <CardContent>
        <h2 className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
          <Bot className="size-4" aria-hidden="true" /> Why it ranks here
        </h2>
        {company.rating_rationale ? (
          <p className="leading-relaxed">{company.rating_rationale}</p>
        ) : (
          <p className="text-muted-foreground">No justification recorded.</p>
        )}
        <Caption className="mb-0">
          {byAgent
            ? `Rated by the Fathom agent${company.rating_model ? ` (${company.rating_model})` : ""}${when}. Change any rating below: a person's ratings replace the agent's, and the agent never overwrites them.`
            : `Ratings set by ${company.rated_by}${when}.${company.rating_rationale ? " The justification above is the Fathom agent's, from before the change." : ""}`}
        </Caption>
      </CardContent>
    </Card>
  );
}
