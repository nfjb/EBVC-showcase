/**
 * Urgency and cockpit priority (user decision 2026-09-30: Importance × Urgency, and urgency
 * never comes from time in queue). The Urgency Score follows the LP scoring matrix: five
 * dimensions, a raw sum out of 120, normalised to 0–100.
 */

import { describe, expect, it } from "vitest";

import { loadTriageConfig } from "@/lib/triage/config";
import { pyRound } from "@/lib/triage/py";
import {
  buildLine,
  quadrant,
  rankByPriority,
  urgency,
  urgencyBreakdown,
  urgencySummary,
  type LineCompany,
} from "@/lib/triage/urgency";

const TODAY = "2026-09-30"; // Wednesday
const RULES = loadTriageConfig().urgency;

type Intro = { channel: string; intro_status: string; received_at: string; introducer_type: string };

function idFor(name: string): number {
  return Array.from(name).reduce((hash, character) => (hash * 31 + character.codePointAt(0)!) % 10_000, 7);
}

function company(
  name = "Robotix AI",
  overrides: Partial<LineCompany<Intro>> & { intros?: Intro[] } = {},
): LineCompany<Intro> {
  const { intros = [], ...fields } = overrides;
  return {
    id: idFor(name),
    name,
    score: 10.0,
    first_seen_at: "2026-09-20",
    latest_signal_at: null,
    rank_override: null,
    status: "open",
    passed_hard_filters: true,
    touchpoints: intros,
    ...fields,
  };
}

function intro(received_at: string, intro_status = "open", introducer_type = "LP"): Intro {
  return { channel: "warm_intro", intro_status, received_at, introducer_type };
}

describe("urgency and priority", () => {
  it("does not change urgency or priority with days in queue", () => {
    const fresh = buildLine(company("Robotix AI", { first_seen_at: "2026-09-29" }), TODAY);
    const stale = buildLine(company("Robotix AI", { first_seen_at: "2026-06-01" }), TODAY);
    expect(fresh.urgency).toBe(stale.urgency);
    expect(fresh.priority).toBe(stale.priority);
    expect(stale.flag).toBeTruthy(); // queue age only raises the flag
    expect(fresh.flag).toBeFalsy();
  });

  const OVERDUE = {
    past_deadline: true,
    escalation: "Escalated to responsible partner",
    deadline: "2026-09-25",
    working_days_elapsed: 4,
  } as const;
  const DUE_TODAY = {
    past_deadline: false,
    escalation: "Escalated to responsible partner",
    deadline: "2026-09-30",
    working_days_elapsed: 3,
  } as const;
  const REMINDER = {
    past_deadline: false,
    escalation: "Reminder to owner",
    deadline: "2026-10-01",
    working_days_elapsed: 2,
  } as const;
  const IN_TIME = {
    past_deadline: false,
    escalation: "On track",
    deadline: "2026-10-02",
    working_days_elapsed: 0,
  } as const;
  const touch = (channel: string, received_at: string, introducer_type = "none") => ({
    channel,
    received_at,
    introducer_type,
  });

  it("adds five dimensions to a raw score out of 120 and normalises it to 0–100", () => {
    const breakdown = urgencyBreakdown(
      {
        latest_signal_at: "2026-09-20",
        latest_signal_type: "traction_update",
        touchpoints: [touch("warm_intro", "2026-09-29", "LP")],
      },
      OVERDUE,
      TODAY,
      "LP",
    );
    expect(breakdown.rows.map((row) => [row.dimension, row.points, row.max])).toEqual([
      ["reply_obligation", 40, 40],
      ["relationship", 20, 20],
      ["activity", 25, 25],
      ["competitive_pressure", 14, 20],
      ["momentum", 15, 15],
    ]);
    expect(breakdown.raw).toBe(114);
    expect(breakdown.max_raw).toBe(120);
    expect(breakdown.score).toBe(Math.round((114 / 120) * 100));
    expect(urgencySummary(breakdown)).toBe("95/100 (raw 114/120) · Act today");
    expect(breakdown.rows[0].note).toBe("LP intro reply overdue since Fri 25 Sep");
  });

  it("never scores zero: a quiet cold deal still lands in the lowest tier", () => {
    const quiet = urgencyBreakdown(
      { latest_signal_at: null, touchpoints: [touch("cold_email", "2026-06-01")] },
      null,
      TODAY,
    );
    expect(quiet.raw).toBe(RULES.relationship.cold);
    expect(quiet.score).toBeGreaterThan(0);
    expect(quiet.tier.label).toBe("No rush");
  });

  it("ranks the warm-intro deadline stages: overdue > due today > reminder > open > none", () => {
    const deal = { latest_signal_at: null, touchpoints: [touch("warm_intro", "2026-06-01", "angel")] };
    const scores = [OVERDUE, DUE_TODAY, REMINDER, IN_TIME, null].map((state) => urgency(deal, state, TODAY));
    expect([...scores].sort((x, y) => y - x)).toEqual(scores);
    expect(new Set(scores).size).toBe(scores.length);
  });

  it("rates the relationship: warm intro > several channels > a single cold inbound", () => {
    const points = (touchpoints: ReturnType<typeof touch>[]) =>
      urgencyBreakdown({ latest_signal_at: null, touchpoints }, null, TODAY).rows.find(
        (row) => row.dimension === "relationship",
      )!.points;
    expect(points([touch("warm_intro", "2026-06-01", "LP")])).toBe(RULES.relationship.warm_intro);
    expect(points([touch("cold_email", "2026-06-01"), touch("linkedin", "2026-06-02")])).toBe(
      RULES.relationship.repeat_contact,
    );
    expect(points([touch("cold_email", "2026-06-01")])).toBe(RULES.relationship.cold);
  });

  it("counts competitive pressure only for a recent signal, an announced round highest", () => {
    const pressure = (latest_signal_at: string, latest_signal_type: string) =>
      urgencyBreakdown({ latest_signal_at, latest_signal_type, touchpoints: [] }, null, TODAY).rows.find(
        (row) => row.dimension === "competitive_pressure",
      )!.points;
    expect(pressure("2026-09-01", "round_announced")).toBe(RULES.competitive_pressure.round_announced);
    expect(pressure("2026-09-01", "round_announced")).toBeGreaterThan(pressure("2026-09-01", "news"));
    expect(pressure("2026-05-01", "round_announced")).toBe(0);
  });

  it("measures founder momentum by the latest inbound, not the first one", () => {
    const momentum = (dates: string[]) =>
      urgencyBreakdown(
        { latest_signal_at: null, touchpoints: dates.map((day) => touch("cold_email", day)) },
        null,
        TODAY,
      ).rows.find((row) => row.dimension === "momentum")!.points;
    expect(momentum(["2026-03-01", "2026-09-28"])).toBe(RULES.momentum[0].points);
    expect(momentum(["2026-03-01"])).toBe(0);
  });

  it("is score % × urgency", () => {
    const line = buildLine(company("Robotix AI", { score: 10.5 }), TODAY);
    expect(line.priority).toBe(pyRound((line.score_percent * line.urgency) / 100, 1));
  });

  it("sets the next action for an open intro and marks it urgent", () => {
    const line = buildLine(company("Robotix AI", { intros: [intro("2026-09-28")] }), TODAY);
    expect(line.next_action).toBe("LP intro reply · Thu");
    expect(line.urgent).toBe(true);
    expect(line.next_action_kind).toBe("intro");
    expect(line.tasks).toContain("Reply to warm intro");
  });

  it("does not make a replied intro a task", () => {
    const line = buildLine(company("Robotix AI", { intros: [intro("2026-09-28", "replied")] }), TODAY);
    expect(line.tasks).not.toContain("Reply to warm intro");
  });

  it("waits for a pass draft approval when a hard filter failed", () => {
    const line = buildLine(company("Robotix AI", { passed_hard_filters: false }), TODAY);
    expect(line.next_action).toBe("Approve pass draft");
    const sent = buildLine(
      company("Robotix AI", { passed_hard_filters: false }),
      TODAY,
      new Set(),
      new Set([company().id]),
    );
    expect(sent.tasks).not.toContain("Approve pass draft");
  });

  it("ranks by priority and keeps pinned ranks", () => {
    const urgent = buildLine(company("Urgent", { score: 9.0, intros: [intro("2026-09-21")] }), TODAY);
    const calm = buildLine(company("Calm", { score: 12.0 }), TODAY);
    const pinned = buildLine(company("Pinned", { score: 1.0, rank_override: 1 }), TODAY);
    expect(rankByPriority([calm, urgent, pinned]).map((line) => line.company.name)).toEqual([
      "Pinned",
      "Urgent",
      "Calm",
    ]);
  });

  it("orders deals nobody has rated (all 0 %) by urgency", () => {
    const calm = buildLine(company("Calm", { score: 0 }), TODAY);
    const overdue = buildLine(company("Overdue", { score: 0, intros: [intro("2026-09-21")] }), TODAY);
    const signal = buildLine(company("Signal", { score: 0, latest_signal_at: "2026-09-25" }), TODAY);
    expect(rankByPriority([calm, signal, overdue]).map((line) => line.company.name)).toEqual([
      "Overdue",
      "Signal",
      "Calm",
    ]);
  });

  it("asks for the Fathom rating while any dimension is unrated", () => {
    const line = buildLine(company("Unrated", { score: 0 }), TODAY);
    expect(line.tasks).toContain("Rate the Fathom criteria");
    expect(line.next_action).toBe("Rate the deal");
  });

  it("places matrix quadrants at the configured splits", () => {
    const splits = loadTriageConfig().matrix;
    const [high, low] = [splits.score_split, splits.score_split - 1];
    const [urgentValue, calmValue] = [splits.urgency_split, splits.urgency_split - 1];
    expect(quadrant(high, urgentValue)).toBe("act_now");
    expect(quadrant(high, calmValue)).toBe("plan");
    expect(quadrant(low, urgentValue)).toBe("reply_fast");
    expect(quadrant(low, calmValue)).toBe("park");
  });
});
