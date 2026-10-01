/**
 * Urgency and cockpit priority (user decision 2026-09-30: score % × urgency, and urgency
 * never comes from time in queue).
 */

import { describe, expect, it } from "vitest";

import { loadTriageConfig } from "@/lib/triage/config";
import { pyRound } from "@/lib/triage/py";
import { buildLine, quadrant, rankByPriority, urgency, type LineCompany } from "@/lib/triage/urgency";

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

  it("makes an overdue intro more urgent than one still in time", () => {
    const overdue = { past_deadline: true, escalation: "Escalated to responsible partner" } as const;
    const inTime = { past_deadline: false, escalation: "On track" } as const;
    expect(urgency(null, { ...overdue, deadline: "2026-09-29", working_days_elapsed: 4 }, TODAY)).toBe(
      RULES.intro_overdue,
    );
    expect(urgency(null, { ...inTime, deadline: "2026-10-02", working_days_elapsed: 0 }, TODAY)).toBe(
      RULES.intro_open,
    );
    expect(RULES.intro_overdue).toBeGreaterThan(RULES.intro_open);
  });

  it("raises urgency for a recent signal, less for an older one", () => {
    expect(urgency("2026-09-25", null, TODAY)).toBe(RULES.base + RULES.recent_signal_bonus);
    expect(urgency("2026-08-25", null, TODAY)).toBe(RULES.base + RULES.signal_bonus);
    expect(urgency(null, null, TODAY)).toBe(RULES.base);
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

  it("asks for the O1 rating while any dimension is unrated", () => {
    const line = buildLine(company("Unrated", { score: 0 }), TODAY);
    expect(line.tasks).toContain("Rate the O1 criteria");
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
