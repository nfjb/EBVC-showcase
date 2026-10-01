"""The pipeline over the generated demo files, and the human actions (spec §1–§5, §8).

Lex runs tests without per-test rollback, so every test rebuilds the CRM first.
Expected figures come from the spec (412 raw records, 25 warm intros, the Robotix
showcase with five arrivals), not from the pipeline's own output.
"""

import datetime
from pathlib import Path

import pytest

from Inputs.Company import Company
from Inputs.Decision import Decision
from Inputs.MergeSuggestion import MergeSuggestion
from Inputs.Touchpoint import Touchpoint
from Uploads._filters import OUTSIDE_GEOGRAPHY, OUTSIDE_STAGE, TICKET_MISMATCH
from Uploads._pipeline import run_pipeline
from Uploads._triage_actions import (
    ActionRefused,
    advance,
    approve_merge,
    override_rank,
    pass_deal,
    rank_worklist,
    reject_merge,
    save_ratings,
    set_intro_status,
)

pytestmark = pytest.mark.integration

DEMO = Path(__file__).resolve().parent.parent / "demo"
PERSON = "Astrid Holm"


@pytest.fixture
def counts():
    Decision.objects.all().delete()
    with (
        open(DEMO / "inbound_records.csv", "rb") as inbound,
        open(DEMO / "signals.csv", "rb") as signals,
    ):
        return run_pipeline(inbound, signals)


def robotix():
    return Company.objects.get(website_domain="robotix.example")


def test_every_raw_record_is_kept_as_a_touchpoint(counts):
    assert counts["raw_records"] == 412
    assert Touchpoint.objects.count() == 412
    assert Touchpoint.objects.filter(channel="warm_intro").count() == 25


def test_robotix_showcase_is_one_company_with_its_full_history(counts):
    company = robotix()
    history = list(company.touchpoints.order_by("received_at"))
    assert company.touchpoint_count == 5
    assert [touchpoint.channel for touchpoint in history] == [
        "website_form",
        "cold_email",
        "cold_email",
        "warm_intro",
        "linkedin",
    ]
    assert history[0].received_at == datetime.date(2026, 6, 9)
    assert {history[1].recipient, history[2].recipient} == {"Astrid Holm", "Jonas Weber"}
    assert history[3].introducer_type == "LP"
    assert company.passed_hard_filters


def test_failing_companies_carry_a_hard_filter_pass_code(counts):
    failing = Company.objects.filter(passed_hard_filters=False)
    assert failing.exists()
    assert set(failing.values_list("pass_code", flat=True)) <= {
        OUTSIDE_STAGE,
        OUTSIDE_GEOGRAPHY,
        TICKET_MISMATCH,
    }
    assert not Company.objects.filter(passed_hard_filters=True).exclude(pass_code="").exists()


def test_pipeline_never_rates_team_or_market_and_writes_no_decisions(counts):
    assert not Company.objects.exclude(team=None).exists()
    assert not Company.objects.exclude(market=None).exists()
    assert not Company.objects.filter(thesis_fit_confirmed=True).exists()
    assert Decision.objects.count() == 0


def test_suggested_merges_wait_for_a_person(counts):
    assert counts["suggested_merges"] > 0
    assert Company.objects.count() == counts["companies"]
    assert set(MergeSuggestion.objects.values_list("status", flat=True)) == {"pending"}


def test_approving_a_merge_moves_touchpoints_and_is_logged(counts):
    suggestion = MergeSuggestion.objects.first()
    company, candidate = suggestion.company, suggestion.candidate
    expected_touchpoints = company.touchpoints.count() + candidate.touchpoints.count()
    approve_merge(suggestion, PERSON)
    company.refresh_from_db()
    assert company.touchpoint_count == expected_touchpoints
    assert not Company.objects.filter(pk=candidate.pk).exists()
    decision = Decision.objects.get(decision="merge_approved")
    assert decision.decided_by == PERSON and decision.company == company


def test_rejecting_a_merge_keeps_both_companies(counts):
    suggestion = MergeSuggestion.objects.first()
    reject_merge(suggestion, PERSON)
    assert Company.objects.filter(pk=suggestion.candidate.pk).exists()
    assert Decision.objects.filter(decision="merge_rejected").count() == 1


def test_advance_and_pass_are_logged_with_who_and_pass_code(counts):
    open_deals = Company.objects.filter(passed_hard_filters=True, status="open")
    advance(open_deals[0], PERSON, comment="Strong fit")
    pass_deal(open_deals[1], "market_too_small", PERSON)
    logged = {decision.decision: decision for decision in Decision.objects.all()}
    assert logged["advance"].decided_by == PERSON
    assert logged["pass"].pass_code == "market_too_small"
    assert logged["pass"].decided_at is not None


def test_pass_code_other_requires_a_comment(counts):
    with pytest.raises(ActionRefused):
        pass_deal(robotix(), "other", PERSON, comment=" ")


def test_rank_override_requires_a_comment_and_pins_the_position(counts):
    with pytest.raises(ActionRefused):
        override_rank(robotix(), 1, "", PERSON)
    override_rank(robotix(), 1, "Partner meeting asked to see it first", PERSON)
    ranked = rank_worklist(list(Company.objects.all()))
    assert ranked[0] == robotix()
    assert Decision.objects.filter(decision="rank_override").count() == 1


def test_human_ratings_rescore_and_are_logged(counts):
    company = robotix()
    before = company.score
    save_ratings(company, thesis_fit=3, market=3, team=2, decided_by=PERSON)
    company.refresh_from_db()
    assert company.score > before
    assert company.thesis_fit_confirmed and company.team == 2
    assert Decision.objects.filter(decision="rating_changed").count() == 1


def test_marking_an_intro_replied_is_logged(counts):
    intro = robotix().touchpoints.get(channel="warm_intro")
    set_intro_status(intro, "replied", PERSON)
    intro.refresh_from_db()
    assert intro.intro_status == "replied"
    assert Decision.objects.filter(decision="intro_replied").count() == 1


def test_audit_log_survives_a_re_upload(counts):
    advance(robotix(), PERSON)
    with (
        open(DEMO / "inbound_records.csv", "rb") as inbound,
        open(DEMO / "signals.csv", "rb") as signals,
    ):
        run_pipeline(inbound, signals)
    decision = Decision.objects.get(decision="advance")
    assert decision.company is None
    assert decision.company_name == "Robotix AI"
