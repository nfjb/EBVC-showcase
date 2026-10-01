"use client";

/** The forms on Deal detail: ratings, the decision, messages, and the rank override. */

import { Ban, Mail, Pin } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { overrideRankAction, saveRatingsAction } from "@/lib/crm/actions";
import { loadTriageConfig } from "@/lib/triage/config";
import { pyFixed } from "@/lib/triage/py";
import { O1_DIMENSIONS, ratedCount, scoreBand, scoreCompany, type O1Ratings } from "@/lib/triage/scoring";

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

/** A single choice from ``options``; clicking the chosen value clears it. */
function Segmented({
  name,
  legend,
  hint,
  options,
  value,
  onChange,
}: {
  /** Plain-text name for screen readers ("Team: 4"). */
  name: string;
  legend: ReactNode;
  hint?: string;
  options: number[];
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const id = useId();
  return (
    <div className="grid gap-x-6 gap-y-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" role="group" aria-labelledby={id}>
      <div>
        <div id={id} className="text-sm font-medium">
          {legend}
        </div>
        {hint ? <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{hint}</p> : null}
      </div>
      <ToggleGroup
        type="single"
        variant="outline"
        spacing={1}
        value={value === null ? "" : String(value)}
        onValueChange={(next) => onChange(next ? Number(next) : null)}
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option}
            value={String(option)}
            aria-label={`${name}: ${option}`}
            className="h-8 min-w-9 rounded-full bg-card font-semibold data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background"
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
  ratings: O1Ratings;
  pass: PassDialogData;
  /** The latest warm intro, when it is still open. */
  introReply: IntroDialogData | null;
  /** The latest warm intro, whatever its status. */
  introducerThanks: IntroDialogData | null;
  sentCount: number;
}

function range(low: number, high: number): number[] {
  return Array.from({ length: high - low + 1 }, (_, index) => low + index);
}

function RatingsForm({ data }: { data: DecideData }) {
  const { o1 } = loadTriageConfig();
  const [ratings, setRatings] = useState<O1Ratings>(data.ratings);
  const { run, pending, error } = useAction();
  const [preview] = scoreCompany(ratings, o1);
  const band = scoreBand(preview, ratedCount(ratings), o1);
  const set = (key: keyof O1Ratings) => (value: number | null) => setRatings((current) => ({ ...current, [key]: value }));
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        run(() => saveRatingsAction(data.companyId, ratings));
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p>
          <strong>O1 investment criteria</strong> · 1 = weak … {o1.scale_max} = strong
        </p>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          If saved: <strong className="text-foreground tabular-nums">{pyFixed(preview, 1)} %</strong> · {band}
        </p>
      </div>
      <div className="divide-y">
        {O1_DIMENSIONS.map((dimension) => (
          <Segmented
            key={dimension.key}
            name={dimension.label}
            legend={
              <>
                {dimension.label} <span className="font-normal text-muted-foreground">· {o1.weights[dimension.key]} %</span>
              </>
            }
            hint={dimension.assesses}
            options={range(1, o1.scale_max)}
            value={ratings[dimension.key]}
            onChange={set(dimension.key)}
          />
        ))}
        <Segmented
          name="Storytelling bonus"
          legend={
            <>
              Storytelling & design <span className="font-normal text-muted-foreground">· bonus, 0–{o1.storytelling_bonus_max} points</span>
            </>
          }
          hint="Optional: how clearly and convincingly the deck tells the story."
          options={range(0, o1.storytelling_bonus_max)}
          value={ratings.storytelling_bonus}
          onChange={set("storytelling_bonus")}
        />
      </div>
      <Button type="submit" variant="outline" size="lg" className="mt-3" disabled={pending}>
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
      <RatingsForm key={JSON.stringify(data.ratings)} data={data} />
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
