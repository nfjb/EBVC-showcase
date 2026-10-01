"""Reply drafts and the simulated send (spec §5, §7): consistent, signed, logged, never emailed."""

from pathlib import Path

import pytest

from Inputs.Company import Company
from Inputs.Decision import Decision
from Inputs.OutboxMessage import OutboxMessage
from Uploads._pipeline import run_pipeline
from Uploads._replies import (
    intro_reply_draft,
    introducer_thanks_draft,
    pass_and_reply,
    pass_reply_draft,
    send_reply,
)
from Uploads._triage_actions import ActionRefused

pytestmark = pytest.mark.integration

DEMO = Path(__file__).resolve().parent.parent / "demo"
PERSON = "Mette Lund"


@pytest.fixture
def robotix():
    Decision.objects.all().delete()
    OutboxMessage.objects.all().delete()
    with (
        open(DEMO / "inbound_records.csv", "rb") as inbound,
        open(DEMO / "signals.csv", "rb") as signals,
    ):
        run_pipeline(inbound, signals)
    return Company.objects.get(website_domain="robotix.example")


def test_intro_reply_thanks_the_introducer_and_is_signed_by_the_recipient(robotix):
    intro = robotix.touchpoints.get(channel="warm_intro")
    draft = intro_reply_draft(intro)
    assert draft.recipient_name == "Freja Lindqvist"
    assert "Hvidsten Family Office" in draft.body
    assert draft.body.rstrip().endswith(f"{intro.recipient}\nSkarv Ventures")


def test_sending_an_intro_reply_marks_it_replied_and_logs_it(robotix):
    intro = robotix.touchpoints.get(channel="warm_intro")
    send_reply(robotix, intro_reply_draft(intro), PERSON, intro=intro)
    intro.refresh_from_db()
    assert intro.intro_status == "replied"
    message = OutboxMessage.objects.get()
    assert message.kind == "intro_reply" and message.sent_by == PERSON
    assert Decision.objects.filter(decision="message_sent").count() == 1


def test_pass_reply_names_the_reason_and_is_signed_by_the_person_first_contacted(robotix):
    draft = pass_reply_draft(robotix, "outside_geography")
    assert "Nordics and DACH" in draft.body
    assert draft.body.rstrip().endswith(f"{robotix.owner}\nSkarv Ventures")


def test_pass_reason_other_uses_the_comment_and_requires_one(robotix):
    with pytest.raises(ActionRefused):
        pass_reply_draft(robotix, "other", " ")
    assert (
        "we already back a similar team"
        in pass_reply_draft(robotix, "other", "we already back a similar team").body
    )


def test_pass_and_reply_records_both_the_decision_and_the_message(robotix):
    pass_and_reply(
        robotix, "market_too_small", PERSON, "", pass_reply_draft(robotix, "market_too_small")
    )
    robotix.refresh_from_db()
    assert robotix.status == "passed" and robotix.pass_code == "market_too_small"
    assert set(Decision.objects.values_list("decision", flat=True)) == {"pass", "message_sent"}
    assert OutboxMessage.objects.get().kind == "pass"


def test_introducer_thanks_reports_the_outcome(robotix):
    intro = robotix.touchpoints.get(channel="warm_intro")
    robotix.status = "advanced"
    robotix.save()
    draft = introducer_thanks_draft(intro)
    assert draft.recipient_name == "Hvidsten Family Office"
    assert "taking it forward" in draft.body


def test_a_reply_without_a_message_is_refused(robotix):
    draft = pass_reply_draft(robotix, "outside_stage")
    draft.body = "  "
    with pytest.raises(ActionRefused):
        send_reply(robotix, draft, PERSON)


def test_outbox_survives_a_re_upload(robotix):
    intro = robotix.touchpoints.get(channel="warm_intro")
    send_reply(robotix, intro_reply_draft(intro), PERSON, intro=intro)
    with (
        open(DEMO / "inbound_records.csv", "rb") as inbound,
        open(DEMO / "signals.csv", "rb") as signals,
    ):
        run_pipeline(inbound, signals)
    message = OutboxMessage.objects.get()
    assert message.company is None and message.company_name == "Robotix AI"
