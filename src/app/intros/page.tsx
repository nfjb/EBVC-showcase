"use client";

/**
 * Intro tracker (Lane A): every warm intro gets a reply within three working days, whatever
 * the fit. Day 2: reminder to the owner. Day 3: escalated to the responsible partner.
 */

import Link from "next/link";

import { Mail } from "lucide-react";

import { RememberDealList } from "@/components/dealList";
import { IntroMoreActions } from "@/components/IntroActions";
import { IntroReplyButton } from "@/components/ReplyDialogs";
import { Caption, DataTable, Notice, PageTitle } from "@/components/page";
import { Tabs } from "@/components/Tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCrm } from "@/components/useCrm";
import * as repo from "@/lib/db/repository";
import { dealHref } from "@/lib/routes";
import { introReplyDialogData } from "@/lib/crm/dialogData";
import { introStates, type IntroWithState } from "@/lib/crm/views";
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
    <Card className="my-2.5">
      <CardContent className="flex flex-wrap items-start gap-4">
        <div className="flex-[3_1_320px]">
          <strong>{company.name}</strong> · {introUrgency(intro.intro_status, state)}
          <br />
          From <strong>{intro.introducer_name}</strong> ({label(INTRODUCER_LABELS, intro.introducer_type)}) · received{" "}
          {longDate(intro.received_at)} · {ownership}
        </div>
        <div className="flex flex-[2_1_260px] items-start justify-end gap-2">
          <IntroReplyButton data={introReplyDialogData(intro, withTouchpoints)} variant="default" size="lg">
            <Mail aria-hidden="true" /> Reply
          </IntroReplyButton>
          <Button variant="outline" size="lg" asChild>
            <Link href={dealHref(company.id, HERE)}>Open deal</Link>
          </Button>
          <IntroMoreActions introId={intro.id} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function IntroTrackerPage() {
  useCrm();
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
      <PageTitle>Intro tracker</PageTitle>
      <Caption>
        Warm intros get a reply within {replyDays} working days, whatever the fit. Day 2: reminder to the owner. Day 3:
        escalated to the responsible partner.
      </Caption>
      <RememberDealList title="Intros needing a reply" ids={[...new Set(waiting.map(({ company }) => company.id))]} />
      <Tabs labels={[`Needs a reply (${waiting.length})`, `All intros (${states.length})`]}>
        <div>
          {!waiting.length ? <Notice tone="success">Every warm intro has had a reply.</Notice> : null}
          {waiting.map((item) => (
            <IntroCard key={item.intro.id} item={item} />
          ))}
        </div>
        <DataTable tall>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Introducer</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Received</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {all.map(({ intro, company, state }) => (
              <TableRow key={intro.id}>
                <TableCell>{company.name}</TableCell>
                <TableCell>{intro.introducer_name}</TableCell>
                <TableCell>{label(INTRODUCER_LABELS, intro.introducer_type)}</TableCell>
                <TableCell>{intro.received_at}</TableCell>
                <TableCell>{intro.recipient}</TableCell>
                <TableCell>{state.deadline}</TableCell>
                <TableCell>{introUrgency(intro.intro_status, state)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </DataTable>
      </Tabs>
    </>
  );
}
