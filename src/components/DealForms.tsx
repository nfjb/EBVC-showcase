"use client";

/** The forms on Deal detail: ratings, the decision, messages, and the rank override. */

import { Ban, Mail, Pin } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { overrideRankAction, saveRatingsAction } from "@/lib/crm/actions";
import { loadTriageConfig } from "@/lib/triage/config";
import { pyFixed } from "@/lib/triage/py";
import { FATHOM_DIMENSIONS, ratedCount, scoreBand, scoreCompany, type FathomRatings } from "@/lib/triage/scoring";

import { Caption } from "./page";
import {
  AdvanceForm,
  ErrorLine,
  Field as LabelledField,
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
  return (
    <Field orientation="responsive" className="py-3">
      <FieldContent>
        <FieldTitle>{legend}</FieldTitle>
        {hint ? <FieldDescription>{hint}</FieldDescription> : null}
      </FieldContent>
      <ToggleGroup
        type="single"
        variant="outline"
        spacing={1}
        aria-label={name}
        value={value === null ? "" : String(value)}
        onValueChange={(next) => onChange(next ? Number(next) : null)}
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option}
            value={String(option)}
            aria-label={`${name}: ${option}`}
            className="size-8 rounded-full font-semibold data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            {option}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Field>
  );
}

export interface DecideData {
  companyId: number;
  status: string;
  statusLabel: string;
  ratings: FathomRatings;
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
  const { fathom } = loadTriageConfig();
  const [ratings, setRatings] = useState<FathomRatings>(data.ratings);
  const { run, pending, error } = useAction();
  const [preview] = scoreCompany(ratings, fathom);
  const band = scoreBand(preview, ratedCount(ratings), fathom);
  const set = (key: keyof FathomRatings) => (value: number | null) =>
    setRatings((current) => ({ ...current, [key]: value }));
  return (
    <Card>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          run(() => saveRatingsAction(data.companyId, ratings));
        }}
      >
        <CardHeader className="border-b">
          <CardTitle>Fathom investment criteria</CardTitle>
          <CardDescription>
            1 = weak … {fathom.scale_max} = strong. Change any rating the agent set; yours replace its.
          </CardDescription>
          <p className="text-sm" aria-live="polite">
            If saved: <strong className="tabular-nums">{pyFixed(preview, 1)} %</strong>{" "}
            <span className="text-muted-foreground">· {band}</span>
          </p>
        </CardHeader>
        <CardContent>
          <FieldGroup className="gap-0 divide-y">
            {FATHOM_DIMENSIONS.map((dimension) => (
              <Segmented
                key={dimension.key}
                name={dimension.label}
                legend={
                  <>
                    {dimension.label}{" "}
                    <span className="font-normal text-muted-foreground">· {fathom.weights[dimension.key]} %</span>
                  </>
                }
                hint={dimension.assesses}
                options={range(1, fathom.scale_max)}
                value={ratings[dimension.key]}
                onChange={set(dimension.key)}
              />
            ))}
            <Segmented
              name="Storytelling bonus"
              legend={
                <>
                  Storytelling & design{" "}
                  <span className="font-normal text-muted-foreground">
                    · bonus, 0–{fathom.storytelling_bonus_max} points
                  </span>
                </>
              }
              hint="Optional: how clearly and convincingly the deck tells the story."
              options={range(0, fathom.storytelling_bonus_max)}
              value={ratings.storytelling_bonus}
              onChange={set("storytelling_bonus")}
            />
          </FieldGroup>
          <Button type="submit" className="mt-3" disabled={pending}>
            Save ratings
          </Button>
          <ErrorLine error={error} />
        </CardContent>
      </form>
    </Card>
  );
}

export function DecideSection({ data }: { data: DecideData }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      {/* A fresh form whenever the stored ratings change (after a save). */}
      <RatingsForm key={JSON.stringify(data.ratings)} data={data} />
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Decision</CardTitle>
            <CardDescription>
              {data.status !== "open"
                ? `Already ${data.statusLabel}.`
                : "Advance or pass; both are logged under your name."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AdvanceForm
              companyId={data.companyId}
              passButton={
                <PassButton data={data.pass}>
                  <Ban aria-hidden="true" /> Pass…
                </PassButton>
              }
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Messages</CardTitle>
            <CardDescription>
              {data.sentCount
                ? `${data.sentCount} message${data.sentCount !== 1 ? "s" : ""} sent from the app (simulated).`
                : "No messages sent yet."}
            </CardDescription>
          </CardHeader>
          {data.introReply || data.introducerThanks ? (
            <CardContent className="flex flex-col gap-2">
              {data.introReply ? (
                <IntroReplyButton data={data.introReply} className="w-full">
                  <Mail aria-hidden="true" /> Reply to the founder
                </IntroReplyButton>
              ) : null}
              {data.introducerThanks ? (
                <IntroducerThanksButton data={data.introducerThanks} className="w-full" />
              ) : null}
            </CardContent>
          ) : null}
        </Card>
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
          <LabelledField label="Pin to rank (0 removes the pin)" className="my-2.5 grid max-w-80 gap-1.5">
            {(id) => (
              <Input
                id={id}
                type="number"
                min={0}
                step={1}
                value={rank}
                onChange={(event) => setRank(event.target.value)}
              />
            )}
          </LabelledField>
          <LabelledField label="Why? (required, logged)">
            {(id) => <Input id={id} value={reason} onChange={(event) => setReason(event.target.value)} />}
          </LabelledField>
          <Button type="submit" variant="outline" size="lg" disabled={pending}>
            <Pin aria-hidden="true" /> Save override
          </Button>
          <ErrorLine error={error} />
        </form>
      </CardContent>
    </Card>
  );
}
