/** Warm-intro reply deadline in working days, weekends skipped (spec §5, Lane A). */

import { addDays, weekday, type IsoDate } from "./dates";

export const ON_TRACK = "On track";
export const REMINDER_TO_OWNER = "Reminder to owner";
export const ESCALATED = "Escalated to responsible partner";

export type Escalation = typeof ON_TRACK | typeof REMINDER_TO_OWNER | typeof ESCALATED;

export interface IntroReplyState {
  deadline: IsoDate;
  working_days_elapsed: number;
  escalation: Escalation;
  past_deadline: boolean;
}

export function addWorkingDays(start: IsoDate, workingDays: number): IsoDate {
  let day = start;
  let added = 0;
  while (added < workingDays) {
    day = addDays(day, 1);
    if (weekday(day) < 5) added += 1;
  }
  return day;
}

/** Working days after ``start`` up to and including ``end`` (0 when end ≤ start). */
export function workingDaysBetween(start: IsoDate, end: IsoDate): number {
  let count = 0;
  let day = start;
  while (day < end) {
    day = addDays(day, 1);
    if (weekday(day) < 5) count += 1;
  }
  return count;
}

/**
 * Deadline, working days elapsed, escalation step and whether the intro is past SLA.
 *
 * Day 2 → reminder to the owner; day 3 (the deadline) onwards → escalate to the
 * responsible partner. Applies to open intros; replied or closed intros are not chased.
 */
export function introReplyState(
  receivedAt: IsoDate,
  today: IsoDate,
  replyWorkingDays: number,
): IntroReplyState {
  const deadline = addWorkingDays(receivedAt, replyWorkingDays);
  const elapsed = workingDaysBetween(receivedAt, today);
  let escalation: Escalation;
  if (elapsed >= replyWorkingDays) escalation = ESCALATED;
  else if (elapsed >= replyWorkingDays - 1) escalation = REMINDER_TO_OWNER;
  else escalation = ON_TRACK;
  return {
    deadline,
    working_days_elapsed: elapsed,
    escalation,
    past_deadline: today > deadline,
  };
}
