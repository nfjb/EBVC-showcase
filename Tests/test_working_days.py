"""Warm-intro SLA: three working days, weekends skipped (spec §5, §10).

2026-09-25 is a Friday and 2026-09-30 (the demo's today) is a Wednesday.
"""

import datetime

import pytest

from Uploads._working_days import (
    ESCALATED,
    ON_TRACK,
    REMINDER_TO_OWNER,
    add_working_days,
    intro_reply_state,
    working_days_between,
)

pytestmark = pytest.mark.unit

FRIDAY = datetime.date(2026, 9, 25)
MONDAY = datetime.date(2026, 9, 28)
TODAY = datetime.date(2026, 9, 30)


def test_friday_intro_is_due_on_wednesday_skipping_the_weekend():
    assert add_working_days(FRIDAY, 3) == datetime.date(2026, 9, 30)


def test_thursday_intro_is_due_on_tuesday():
    assert add_working_days(datetime.date(2026, 9, 24), 3) == datetime.date(2026, 9, 29)


def test_weekend_days_are_not_counted():
    assert working_days_between(FRIDAY, MONDAY) == 1


def test_one_working_day_in_is_on_track():
    state = intro_reply_state(FRIDAY, MONDAY, 3)
    assert state["escalation"] == ON_TRACK
    assert not state["past_deadline"]


def test_day_two_sends_a_reminder_to_the_owner():
    state = intro_reply_state(MONDAY, TODAY, 3)
    assert state["working_days_elapsed"] == 2
    assert state["escalation"] == REMINDER_TO_OWNER
    assert state["deadline"] == datetime.date(2026, 10, 1)


def test_day_three_escalates_to_the_partner_on_the_deadline_day():
    state = intro_reply_state(FRIDAY, TODAY, 3)
    assert state["escalation"] == ESCALATED
    assert state["deadline"] == TODAY
    assert not state["past_deadline"]


def test_intro_older_than_three_working_days_is_past_deadline():
    state = intro_reply_state(datetime.date(2026, 9, 24), TODAY, 3)
    assert state["escalation"] == ESCALATED
    assert state["past_deadline"]
