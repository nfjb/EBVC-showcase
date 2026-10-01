"""Urgency and cockpit priority (user decision 2026-09-30: score % × urgency, and urgency
never comes from time in queue)."""

import datetime
from types import SimpleNamespace

import pytest

from Uploads._triage_config import load_triage_config
from Uploads._urgency import build_line, rank_by_priority, urgency

pytestmark = pytest.mark.unit

TODAY = datetime.date(2026, 9, 30)  # Wednesday
RULES = load_triage_config()["urgency"]


class Touchpoints:
    def __init__(self, items):
        self.items = items

    def all(self):
        return self.items


def company(
    name="Robotix AI",
    score=10.0,
    first_seen=datetime.date(2026, 9, 20),
    intros=(),
    latest_signal_at=None,
    rank_override=None,
    **fields,
):
    values = {
        "pk": hash(name) % 10_000,
        "name": name,
        "score": score,
        "first_seen_at": first_seen,
        "latest_signal_at": latest_signal_at,
        "rank_override": rank_override,
        "status": "open",
        "passed_hard_filters": True,
        "thesis_fit_confirmed": True,
        "market": 2,
        "team": 2,
        "touchpoints": Touchpoints(list(intros)),
    }
    values.update(fields)
    return SimpleNamespace(**values)


def intro(received_at, status="open", introducer_type="LP"):
    return SimpleNamespace(
        channel="warm_intro",
        intro_status=status,
        received_at=received_at,
        introducer_type=introducer_type,
    )


def test_days_in_queue_do_not_change_urgency_or_priority():
    fresh = build_line(company(first_seen=datetime.date(2026, 9, 29)), TODAY)
    stale = build_line(company(first_seen=datetime.date(2026, 6, 1)), TODAY)
    assert fresh.urgency == stale.urgency
    assert fresh.priority == stale.priority
    assert stale.flag and not fresh.flag  # queue age only raises the flag


def test_overdue_intro_is_more_urgent_than_one_still_in_time():
    overdue = {"past_deadline": True, "escalation": "Escalated to responsible partner"}
    in_time = {"past_deadline": False, "escalation": "On track"}
    assert urgency(None, overdue, TODAY) == RULES["intro_overdue"]
    assert urgency(None, in_time, TODAY) == RULES["intro_open"]
    assert RULES["intro_overdue"] > RULES["intro_open"]


def test_recent_signal_raises_urgency_older_signal_less():
    recent = urgency(datetime.date(2026, 9, 25), None, TODAY)
    older = urgency(datetime.date(2026, 8, 25), None, TODAY)
    none = urgency(None, None, TODAY)
    assert recent == RULES["base"] + RULES["recent_signal_bonus"]
    assert older == RULES["base"] + RULES["signal_bonus"]
    assert none == RULES["base"]


def test_priority_is_score_percent_times_urgency():
    line = build_line(company(score=10.5), TODAY)
    assert line.priority == round(line.score_percent * line.urgency / 100, 1)


def test_open_intro_sets_the_next_action_and_is_marked_urgent():
    line = build_line(company(intros=[intro(datetime.date(2026, 9, 28))]), TODAY)
    assert line.next_action == "LP intro reply · Thu"
    assert line.urgent and line.next_action_kind == "intro"
    assert "Reply to warm intro" in line.tasks


def test_replied_intro_is_not_a_task():
    line = build_line(company(intros=[intro(datetime.date(2026, 9, 28), status="replied")]), TODAY)
    assert "Reply to warm intro" not in line.tasks


def test_failed_hard_filter_waits_for_a_pass_draft_approval():
    line = build_line(company(passed_hard_filters=False), TODAY)
    assert line.next_action == "Approve pass draft"
    sent = build_line(company(passed_hard_filters=False), TODAY, pass_reply_sent_ids={company().pk})
    assert "Approve pass draft" not in sent.tasks


def test_ranking_uses_priority_and_keeps_pinned_ranks():
    urgent = build_line(
        company("Urgent", score=9.0, intros=[intro(datetime.date(2026, 9, 21))]), TODAY
    )
    calm = build_line(company("Calm", score=12.0), TODAY)
    pinned = build_line(company("Pinned", score=1.0, rank_override=1), TODAY)
    ranked = [line.company.name for line in rank_by_priority([calm, urgent, pinned])]
    assert ranked == ["Pinned", "Urgent", "Calm"]


def test_matrix_quadrants_follow_the_configured_splits():
    from Uploads._urgency import quadrant

    splits = load_triage_config()["matrix"]
    high, low = splits["score_split"], splits["score_split"] - 1
    urgent, calm = splits["urgency_split"], splits["urgency_split"] - 1
    assert quadrant(high, urgent) == "act_now"
    assert quadrant(high, calm) == "plan"
    assert quadrant(low, urgent) == "reply_fast"
    assert quadrant(low, calm) == "park"
