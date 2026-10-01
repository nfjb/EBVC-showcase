"use client";

/** The forms on Deal detail: ratings, the decision, messages, and the rank override. */

import { Ban, Mail, Pin } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { overrideRankAction, saveRatingsAction } from "@/lib/crm/actions";

import { Caption } from "./page";
import {
  AdvanceForm,
  ErrorLine,
  Field,
  IntroducerThanksButton,
  IntroReplyButton,
  PassButton,
  type IntroDialogData,
  type PassDialogData,
} from "./ReplyDialogs";
import { useAction } from "./useAction";

/** 1 / 2 / 3, single choice; clicking the chosen value clears it. */
function Segmented({
  legend,
  value,
  onChange,
}: {
  legend: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const id = useId();
  return (
    <div className="my-3" role="group" aria-labelledby={id}>
      <div id={id} className="mb-1.5 text-sm font-medium">
        {legend}
      </div>
      <ToggleGroup
        type="single"
        variant="outline"
        spacing={1.5}
        value={value === null ? "" : String(value)}
        onValueChange={(next) => onChange(next ? Number(next) : null)}
      >
        {[1, 2, 3].map((option) => (
          <ToggleGroupItem
            key={option}
            value={String(option)}
            aria-label={`${legend}: ${option}`}
            className="h-9 min-w-11 rounded-full bg-card font-semibold data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background"
          >
            {option}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

export interface DecideData {
  companyId: number;
  status: string;
  statusLabel: string;
  thesisFit: number | null;
  thesisFitConfirmed: boolean;
  market: number | null;
  team: number | null;
  pass: PassDialogData;
  /** The latest warm intro, when it is still open. */
  introReply: IntroDialogData | null;
  /** The latest warm intro, whatever its status. */
  introducerThanks: IntroDialogData | null;
  sentCount: number;
}

function RatingsForm({ data }: { data: DecideData }) {
  const [thesisFit, setThesisFit] = useState<number | null>(data.thesisFit || 1);
  const [market, setMarket] = useState<number | null>(data.market);
  const [team, setTeam] = useState<number | null>(data.team);
  const { run, pending, error } = useAction();
  const suggested = data.thesisFitConfirmed ? "" : ` (suggested: ${data.thesisFit})`;
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        run(() => saveRatingsAction(data.companyId, thesisFit || data.thesisFit || 1, market, team));
      }}
    >
      <p>
        <strong>Ratings</strong> · 1 = weak, 2 = adequate, 3 = strong
      </p>
      <Segmented legend={`Thesis fit${suggested}`} value={thesisFit} onChange={setThesisFit} />
      <Segmented legend="Market" value={market} onChange={setMarket} />
      <Segmented legend="Team" value={team} onChange={setTeam} />
      <Button type="submit" variant="outline" size="lg" disabled={pending}>
        Save ratings
      </Button>
      <ErrorLine error={error} />
    </form>
  );
}

export function DecideSection({ data }: { data: DecideData }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      {/* A fresh form whenever the stored ratings change (after a save). */}
      <RatingsForm key={`${data.thesisFit}-${data.thesisFitConfirmed}-${data.market}-${data.team}`} data={data} />
      <div>
        <p>
          <strong>Decision</strong>
        </p>
        {data.status !== "open" ? <p>Already {data.statusLabel}.</p> : null}
        <AdvanceForm
          companyId={data.companyId}
          passButton={
            <PassButton data={data.pass} size="lg">
              <Ban aria-hidden="true" /> Pass…
            </PassButton>
          }
        />

        <p className="mt-4">
          <strong>Messages</strong>
        </p>
        <div className="my-2.5 flex flex-col gap-2.5">
          {data.introReply ? (
            <IntroReplyButton data={data.introReply} size="lg" className="w-full">
              <Mail aria-hidden="true" /> Reply to the founder
            </IntroReplyButton>
          ) : null}
          {data.introducerThanks ? (
            <IntroducerThanksButton data={data.introducerThanks} size="lg" className="w-full" />
          ) : null}
        </div>
        <Caption>
          {data.sentCount
            ? `${data.sentCount} message${data.sentCount !== 1 ? "s" : ""} sent from the app (simulated).`
            : "No messages sent yet."}
        </Caption>
      </div>
    </div>
  );
}

export function RankOverrideForm({ companyId, current }: { companyId: number; current: number | null }) {
  const [rank, setRank] = useState(String(current ?? 0));
  const [reason, setReason] = useState("");
  const { run, pending, error } = useAction();
  return (
    <Card className="max-w-2xl">
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const pinned = Math.trunc(Number(rank) || 0);
            run(() => overrideRankAction(companyId, pinned > 0 ? pinned : null, reason));
          }}
        >
          <Field label="Pin to rank (0 removes the pin)" className="my-2.5 grid max-w-80 gap-1.5">
            {(id) => (
              <Input id={id} type="number" min={0} step={1} value={rank} onChange={(event) => setRank(event.target.value)} />
            )}
          </Field>
          <Field label="Why? (required, logged)">
            {(id) => <Input id={id} value={reason} onChange={(event) => setReason(event.target.value)} />}
          </Field>
          <Button type="submit" variant="outline" size="lg" disabled={pending}>
            <Pin aria-hidden="true" /> Save override
          </Button>
          <ErrorLine error={error} />
        </form>
      </CardContent>
    </Card>
  );
}
