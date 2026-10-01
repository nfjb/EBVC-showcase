/** Deal detail: one company — decide, see why it scores what it does, its history, pin its rank. */

import { redirect } from "next/navigation";

import { DecideSection, RankOverrideForm } from "@/components/DealForms";
import { DealNavBar, DealPosition, RankMetric } from "@/components/DealNav";
import { Metric } from "@/components/Metric";
import { Tabs } from "@/components/Tabs";
import * as repo from "@/lib/db/repository";
import { pageNameFor, safeReturnHref, withQuery } from "@/lib/routes";
import { introducerThanksDialogData, introReplyDialogData, passDialogData } from "@/lib/server/dialogData";
import { daysInQueue, rankWorklist } from "@/lib/server/triageActions";
import { compareCodePoints, pyFixed } from "@/lib/triage/py";
import { loadTriageConfig } from "@/lib/triage/config";
import {
  CHANNEL_LABELS,
  componentLabel,
  DECISION_LABELS,
  euros,
  INTRO_LABELS,
  label,
  PASS_CODE_LABELS,
  rating,
} from "@/lib/triage/labels";
import type { BreakdownRow } from "@/lib/triage/scoring";
import { queueFlag } from "@/lib/triage/scoring";
import { maximumScore } from "@/lib/triage/urgency";

import { EmptyCrm } from "../EmptyCrm";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DealDetailPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { id } = await params;
  const search = await searchParams;
  const from = safeReturnHref(Array.isArray(search.from) ? search.from[0] : search.from);
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

      <div className="eyebrow">Deal detail</div>
      <h1>{company.name}</h1>
      <p>
        {company.one_liner}
        <br />
        {company.stage} · {euros(company.round_size_eur)} round · {company.country} · owner{" "}
        <strong>{company.owner}</strong> · {company.website_domain || "no website"}
      </p>

      <div className="metrics">
        <Metric label="Decision" value={label(DECISION_LABELS, company.status)} />
        <RankMetric />
        <Metric label="Score" value={`${pyFixed(company.score, 1)} / ${pyFixed(maximumScore(), 0)}`} />
        <Metric label="Days in queue" value={waiting} />
        <Metric label="Touchpoints" value={company.touchpoint_count} />
      </div>
      {flag ? (
        <div className="alert alert-warning">
          ⏳ {flag} — {waiting} days in the queue.
        </div>
      ) : null}
      {!company.passed_hard_filters ? (
        <div className="alert alert-info">⛔ Failed the hard filters: {label(PASS_CODE_LABELS, company.pass_code)}.</div>
      ) : null}
      {company.latest_signal ? <p className="caption">Latest signal: {company.latest_signal}</p> : null}

      <Tabs labels={["Decide", "Score breakdown", `History (${company.touchpoint_count})`, "Rank override"]}>
        <DecideSection
          data={{
            companyId: company.id,
            status: company.status,
            statusLabel: label(DECISION_LABELS, company.status),
            thesisFit: company.thesis_fit,
            thesisFitConfirmed: company.thesis_fit_confirmed,
            market: company.market,
            team: company.team,
            pass: passDialogData(company),
            introReply:
              latestIntro && latestIntro.intro_status === "open" ? introReplyDialogData(latestIntro, company) : null,
            introducerThanks: latestIntro ? introducerThanksDialogData(latestIntro, company) : null,
            sentCount: repo.countOutboxMessagesOf(company.id),
          }}
        />

        <div>
          {breakdown.length ? (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Component</th>
                    <th className="num">Value</th>
                    <th className="num">Weight</th>
                    <th className="num">Points</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((row) => (
                    <tr key={row.component}>
                      <td>{componentLabel(row.component)}</td>
                      <td className="num">{rating(row.value)}</td>
                      <td className="num">{pyFixed(row.weight, 1)}</td>
                      <td className="num">{pyFixed(row.points, 1)}</td>
                      <td>{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <p className="caption">Time in queue is not a score component. Team and market are rated by people only.</p>
        </div>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Received</th>
                <th>Channel</th>
                <th>Sent to</th>
                <th>Name used</th>
                <th>Website</th>
                <th>Introducer</th>
                <th>Intro status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((touchpoint) => (
                <tr key={touchpoint.id}>
                  <td>{touchpoint.received_at}</td>
                  <td>{label(CHANNEL_LABELS, touchpoint.channel)}</td>
                  <td>{touchpoint.recipient}</td>
                  <td>{touchpoint.company_name}</td>
                  <td>{touchpoint.website}</td>
                  <td>{touchpoint.introducer_name}</td>
                  <td>{INTRO_LABELS[touchpoint.intro_status] ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <RankOverrideForm key={company.rank_override ?? 0} companyId={company.id} current={company.rank_override} />
      </Tabs>
    </DealPosition>
  );
}
