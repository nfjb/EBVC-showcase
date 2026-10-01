/**
 * Warm-intro SLA: three working days, weekends skipped (spec §5, §10).
 *
 * 2026-09-25 is a Friday and 2026-09-30 (the demo's today) is a Wednesday.
 */

import { describe, expect, it } from "vitest";

import {
  addWorkingDays,
  ESCALATED,
  introReplyState,
  ON_TRACK,
  REMINDER_TO_OWNER,
  workingDaysBetween,
} from "@/lib/triage/workingDays";

const FRIDAY = "2026-09-25";
const MONDAY = "2026-09-28";
const TODAY = "2026-09-30";

describe("working days", () => {
  it("makes a Friday intro due on Wednesday, skipping the weekend", () => {
    expect(addWorkingDays(FRIDAY, 3)).toBe("2026-09-30");
  });

  it("makes a Thursday intro due on Tuesday", () => {
    expect(addWorkingDays("2026-09-24", 3)).toBe("2026-09-29");
  });

  it("does not count weekend days", () => {
    expect(workingDaysBetween(FRIDAY, MONDAY)).toBe(1);
  });

  it("is on track one working day in", () => {
    const state = introReplyState(FRIDAY, MONDAY, 3);
    expect(state.escalation).toBe(ON_TRACK);
    expect(state.past_deadline).toBe(false);
  });

  it("sends a reminder to the owner on day two", () => {
    const state = introReplyState(MONDAY, TODAY, 3);
    expect(state.working_days_elapsed).toBe(2);
    expect(state.escalation).toBe(REMINDER_TO_OWNER);
    expect(state.deadline).toBe("2026-10-01");
  });

  it("escalates to the partner on day three, the deadline day", () => {
    const state = introReplyState(FRIDAY, TODAY, 3);
    expect(state.escalation).toBe(ESCALATED);
    expect(state.deadline).toBe(TODAY);
    expect(state.past_deadline).toBe(false);
  });

  it("is past the deadline after three working days", () => {
    const state = introReplyState("2026-09-24", TODAY, 3);
    expect(state.escalation).toBe(ESCALATED);
    expect(state.past_deadline).toBe(true);
  });
});
