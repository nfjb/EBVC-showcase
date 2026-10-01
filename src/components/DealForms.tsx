"use client";

/** The forms on Deal detail: ratings, the decision, messages, and the rank override. */

import { useState } from "react";

import { overrideRankAction, saveRatingsAction } from "@/app/actions";

import {
  AdvanceForm,
  ErrorLine,
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
  return (
    <fieldset className="rating">
      <legend>{legend}</legend>
      <div className="segmented">
        {[1, 2, 3].map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(value === option ? null : option)}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
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
      <button type="submit" className="button" disabled={pending}>
        Save ratings
      </button>
      <ErrorLine error={error} />
    </form>
  );
}

export function DecideSection({ data }: { data: DecideData }) {
  return (
    <div className="grid-3-2">
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
            <PassButton data={data.pass} className="button">
              ⛔ Pass…
            </PassButton>
          }
        />

        <p>
          <strong>Messages</strong>
        </p>
        <div className="button-row" style={{ flexDirection: "column" }}>
          {data.introReply ? (
            <IntroReplyButton data={data.introReply} className="button wide">
              ✉️ Reply to the founder
            </IntroReplyButton>
          ) : null}
          {data.introducerThanks ? <IntroducerThanksButton data={data.introducerThanks} className="button wide" /> : null}
        </div>
        <p className="caption">
          {data.sentCount
            ? `${data.sentCount} message${data.sentCount !== 1 ? "s" : ""} sent from the app (simulated).`
            : "No messages sent yet."}
        </p>
      </div>
    </div>
  );
}

export function RankOverrideForm({ companyId, current }: { companyId: number; current: number | null }) {
  const [rank, setRank] = useState(String(current ?? 0));
  const [reason, setReason] = useState("");
  const { run, pending, error } = useAction();
  return (
    <form
      className="card"
      onSubmit={(event) => {
        event.preventDefault();
        const pinned = Math.trunc(Number(rank) || 0);
        run(() => overrideRankAction(companyId, pinned > 0 ? pinned : null, reason));
      }}
    >
      <label className="field inline">
        <span>Pin to rank (0 removes the pin)</span>
        <input type="number" min={0} step={1} value={rank} onChange={(event) => setRank(event.target.value)} />
      </label>
      <label className="field">
        <span>Why? (required, logged)</span>
        <input type="text" value={reason} onChange={(event) => setReason(event.target.value)} />
      </label>
      <button type="submit" className="button" disabled={pending}>
        📌 Save override
      </button>
      <ErrorLine error={error} />
    </form>
  );
}
