/**
 * Intro tracker (Lane A): every warm intro gets a reply within three working days, whatever
 * the fit. Day 2: reminder to the owner. Day 3: escalated to the responsible partner.
 */

import Link from "next/link";

import { RememberDealList } from "@/components/dealList";
import { IntroMoreActions } from "@/components/IntroActions";
import { IntroReplyButton } from "@/components/ReplyDialogs";
import { Tabs } from "@/components/Tabs";
import * as repo from "@/lib/db/repository";
import { dealHref } from "@/lib/routes";
import { introReplyDialogData } from "@/lib/server/dialogData";
import { introStates, type IntroWithState } from "@/lib/server/views";
import { loadTriageConfig, responsiblePartners } from "@/lib/triage/config";
import { longDate } from "@/lib/triage/dates";
import { INTRODUCER_LABELS, introUrgency, label } from "@/lib/triage/labels";
import { pyGet } from "@/lib/triage/py";

import { EmptyCrm } from "../deals/EmptyCrm";

const HERE = "/intros";

function IntroCard({ item }: { item: IntroWithState }) {
  const { intro, company, state } = item;
  const partner = pyGet(responsiblePartners(), intro.recipient, intro.recipient);
  const ownership =
    partner === intro.recipient
      ? `owner ${intro.recipient} (partner)`
      : `owner ${intro.recipient}, escalates to ${partner}`;
  const withTouchpoints = { ...company, touchpoints: repo.touchpointsOf(company.id) };
  return (
    <div className="card" style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
      <div style={{ flex: "3 1 320px" }}>
        <strong>{company.name}</strong> · {introUrgency(intro.intro_status, state)}
        <br />
        From <strong>{intro.introducer_name}</strong> ({label(INTRODUCER_LABELS, intro.introducer_type)}) · received{" "}
        {longDate(intro.received_at)} · {ownership}
      </div>
      <div style={{ flex: "2 1 260px", display: "flex", gap: 8, alignItems: "flex-start", justifyContent: "flex-end" }}>
        <IntroReplyButton data={introReplyDialogData(intro, withTouchpoints)} className="button primary">
          ✉️ Reply
        </IntroReplyButton>
        <Link className="button" href={dealHref(company.id, HERE)}>
          Open deal
        </Link>
        <IntroMoreActions introId={intro.id} />
      </div>
    </div>
  );
}

export default function IntroTrackerPage() {
  const replyDays = loadTriageConfig().intro_reply_working_days;
  const states = introStates();
  if (!states.length) return <EmptyCrm title="Intro tracker" />;
  const waiting = states
    .filter(({ intro }) => intro.intro_status === "open")
    .sort((a, b) =>
      a.state.past_deadline !== b.state.past_deadline
        ? a.state.past_deadline
          ? -1
          : 1
        : a.state.deadline < b.state.deadline
          ? -1
          : a.state.deadline > b.state.deadline
            ? 1
            : 0,
    );
  const all = [...states].sort((a, b) =>
    a.intro.received_at === b.intro.received_at ? 0 : a.intro.received_at < b.intro.received_at ? 1 : -1,
  );
  return (
    <>
      <h1>Intro tracker</h1>
      <p className="caption">
        Warm intros get a reply within {replyDays} working days, whatever the fit. Day 2: reminder to the owner. Day 3:
        escalated to the responsible partner.
      </p>
      <RememberDealList title="Intros needing a reply" ids={[...new Set(waiting.map(({ company }) => company.id))]} />
      <Tabs labels={[`Needs a reply (${waiting.length})`, `All intros (${states.length})`]}>
        <div>
          {!waiting.length ? <div className="alert alert-success">✅ Every warm intro has had a reply.</div> : null}
          {waiting.map((item) => (
            <IntroCard key={item.intro.id} item={item} />
          ))}
        </div>
        <div className="table-wrap tall">
          <table className="data">
            <thead>
              <tr>
                <th>Company</th>
                <th>Introducer</th>
                <th>Type</th>
                <th>Received</th>
                <th>Owner</th>
                <th>Deadline</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {all.map(({ intro, company, state }) => (
                <tr key={intro.id}>
                  <td>{company.name}</td>
                  <td>{intro.introducer_name}</td>
                  <td>{label(INTRODUCER_LABELS, intro.introducer_type)}</td>
                  <td>{intro.received_at}</td>
                  <td>{intro.recipient}</td>
                  <td>{state.deadline}</td>
                  <td>{introUrgency(intro.intro_status, state)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Tabs>
    </>
  );
}
