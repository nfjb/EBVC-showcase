"""Warm-intro reply deadline in working days, weekends skipped (spec §5, Lane A)."""

import datetime

ON_TRACK = "On track"
REMINDER_TO_OWNER = "Reminder to owner"
ESCALATED = "Escalated to responsible partner"


def add_working_days(start: datetime.date, working_days: int) -> datetime.date:
    day = start
    added = 0
    while added < working_days:
        day += datetime.timedelta(days=1)
        if day.weekday() < 5:
            added += 1
    return day


def working_days_between(start: datetime.date, end: datetime.date) -> int:
    """Working days after ``start`` up to and including ``end`` (0 when end ≤ start)."""
    count = 0
    day = start
    while day < end:
        day += datetime.timedelta(days=1)
        if day.weekday() < 5:
            count += 1
    return count


def intro_reply_state(
    received_at: datetime.date, today: datetime.date, reply_working_days: int
) -> dict:
    """Deadline, working days elapsed, escalation step and whether the intro is past SLA.

    Day 2 → reminder to the owner; day 3 (the deadline) onwards → escalate to the
    responsible partner. Applies to open intros; replied or closed intros are not chased.
    """
    deadline = add_working_days(received_at, reply_working_days)
    elapsed = working_days_between(received_at, today)
    if elapsed >= reply_working_days:
        escalation = ESCALATED
    elif elapsed >= reply_working_days - 1:
        escalation = REMINDER_TO_OWNER
    else:
        escalation = ON_TRACK
    return {
        "deadline": deadline,
        "working_days_elapsed": elapsed,
        "escalation": escalation,
        "past_deadline": today > deadline,
    }
