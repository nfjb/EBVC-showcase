"""Company scoring (spec §4, §10) — above all: time in queue never changes the score."""

import datetime

import pytest

from Uploads._scoring import (
    DECIDE_THIS_WEEK,
    DECISION_REQUIRED,
    momentum_from_signals,
    queue_flag,
    score_company,
    source_quality_from_channels,
    suggest_thesis_fit,
)
from Uploads._triage_config import load_thesis_keywords, load_triage_config

pytestmark = pytest.mark.unit

CONFIG = load_triage_config()
WEIGHTS = CONFIG["weights"]


def components(**overrides):
    base = {"thesis_fit": 3, "market": None, "team": None, "momentum": 1, "source_quality": 3}
    base.update(overrides)
    return base


def test_time_in_queue_does_not_affect_score():
    fresh = components(first_seen_at=datetime.date(2026, 9, 29), days_in_queue=1)
    stale = components(first_seen_at=datetime.date(2026, 6, 1), days_in_queue=121)
    assert score_company(fresh, WEIGHTS) == score_company(stale, WEIGHTS)


def test_time_in_queue_raises_flags_instead():
    flags = CONFIG["queue_flags"]
    assert queue_flag(13, flags) == ""
    assert queue_flag(14, flags) == DECIDE_THIS_WEEK
    assert queue_flag(21, flags) == DECISION_REQUIRED


def test_unrated_human_fields_add_nothing_and_say_so():
    _, breakdown = score_company(components(), WEIGHTS)
    by_component = {row["component"]: row for row in breakdown}
    for human_only in ("market", "team"):
        assert by_component[human_only]["value"] is None
        assert by_component[human_only]["points"] == 0
        assert by_component[human_only]["note"] == "Not yet rated (human only)"


def test_score_is_the_weighted_sum_of_the_breakdown():
    score, breakdown = score_company(components(market=2, team=3), WEIGHTS)
    assert score == round(sum(row["points"] for row in breakdown), 2)
    assert [row["component"] for row in breakdown] == [
        "thesis_fit",
        "market",
        "team",
        "momentum",
        "source_quality",
    ]


def test_human_rating_raises_the_score():
    unrated, _ = score_company(components(), WEIGHTS)
    rated, _ = score_company(components(market=3), WEIGHTS)
    assert rated > unrated


def test_thesis_fit_is_marked_suggested_until_confirmed():
    _, suggested = score_company(components(), WEIGHTS)
    _, confirmed = score_company(components(), WEIGHTS, thesis_fit_confirmed=True)
    assert suggested[0]["note"].startswith("Suggested")
    assert confirmed[0]["note"] == "Confirmed"


def test_thesis_fit_suggestion_follows_the_thesis_keywords():
    keywords = load_thesis_keywords()
    assert suggest_thesis_fit("Warehouse robotics for mid-size factories", keywords) == 3
    assert suggest_thesis_fit("Workflow SaaS for construction firms", keywords) == 2
    assert suggest_thesis_fit("A consumer dating app", keywords) == 1
    assert suggest_thesis_fit("", keywords) == 1


def test_warm_intro_beats_cold_inbound():
    quality = CONFIG["source_quality"]
    assert source_quality_from_channels(["website_form", "warm_intro"], quality) > (
        source_quality_from_channels(["website_form", "cold_email"], quality)
    )


def test_momentum_counts_hire_traction_news_and_is_capped():
    assert momentum_from_signals(["senior_hire", "news", "round_announced"], 3) == 2
    assert momentum_from_signals(["news"] * 10, 3) == 3
