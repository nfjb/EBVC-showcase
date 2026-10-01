"""Reply drafts from one template library, and the simulated "send" (spec §5, §7).

Every draft is two or three sentences, names the reason, and is signed by the person the
founder originally contacted, so the tone is consistent across partners. Sending is
simulated: it stores an OutboxMessage and a Decision row, and delivers nothing.
"""

from dataclasses import dataclass

from django.db import transaction
from django.utils import timezone

from Uploads._triage_actions import ActionRefused, log_decision
from Uploads._triage_config import demo_today
from Uploads._working_days import add_working_days

PASS_REASONS = {
    "outside_stage": "we only lead Pre-Seed and Seed rounds, so {company} is at a later stage than we invest",
    "outside_geography": "Fund II invests only in companies based in the Nordics and DACH",
    "ticket_mismatch": "the round size does not fit our ticket of EUR 0.5–2m",
    "outside_thesis": "it sits outside the areas our thesis focuses on",
    "market_too_small": "we are not yet convinced the market is large enough for a venture outcome",
    "portfolio_conflict": "it would overlap with a company already in our portfolio",
    "too_early_revisit_6m": "it is a little early for us, and we would love to hear from you again in six months",
    "other": "{comment}",
}


@dataclass
class ReplyDraft:
    kind: str
    recipient_name: str
    recipient_address: str
    subject: str
    body: str


def _first_name(full_name: str) -> str:
    return (full_name or "there").split()[0]


def _founder(company) -> tuple[str, str]:
    """The founder's name and the most recent address we have for them."""
    touchpoints = company.touchpoints.order_by("-received_at")
    name = next(
        (touchpoint.founder_name for touchpoint in touchpoints if touchpoint.founder_name), ""
    )
    address = next(
        (
            touchpoint.founder_email or touchpoint.founder_linkedin
            for touchpoint in touchpoints
            if touchpoint.founder_email or touchpoint.founder_linkedin
        ),
        "",
    )
    return name, address


def intro_reply_draft(intro) -> ReplyDraft:
    """Acknowledge a warm intro to the founder, whatever the fit (problem 3)."""
    company = intro.company
    founder_name, founder_address = _founder(company)
    reply_by = add_working_days(demo_today(), 5)
    return ReplyDraft(
        kind="intro_reply",
        recipient_name=founder_name,
        recipient_address=founder_address,
        subject=f"{company.name} × Skarv Ventures",
        body=(
            f"Hi {_first_name(founder_name)},\n\n"
            f"Thank you for reaching out, and thanks to {intro.introducer_name} for the introduction. "
            f"We are reviewing {company.name} now and will come back to you by "
            f"{reply_by:%A} {reply_by.day} {reply_by:%B} with a clear answer.\n\n"
            f"Best regards,\n{intro.recipient}\nSkarv Ventures"
        ),
    )


def pass_reply_draft(company, pass_code: str, comment: str = "") -> ReplyDraft:
    """A short, personal pass with the named reason, signed by the person first contacted."""
    if pass_code not in PASS_REASONS:
        raise ActionRefused(f"Unknown pass code: {pass_code}.")
    if pass_code == "other" and not comment.strip():
        raise ActionRefused("Pass code 'other' needs a comment to use as the reason.")
    founder_name, founder_address = _founder(company)
    reason = PASS_REASONS[pass_code].format(company=company.name, comment=comment.strip())
    return ReplyDraft(
        kind="pass",
        recipient_name=founder_name,
        recipient_address=founder_address,
        subject=f"{company.name} × Skarv Ventures",
        body=(
            f"Hi {_first_name(founder_name)},\n\n"
            f"Thank you for sharing {company.name} with us — we enjoyed learning about it. "
            f"We have decided not to invest this time, because {reason}. "
            "We wish you the very best with the round and would be glad to stay in touch.\n\n"
            f"Best regards,\n{company.owner}\nSkarv Ventures"
        ),
    )


def introducer_thanks_draft(intro) -> ReplyDraft:
    """Close the loop with the LP, portfolio founder or angel who made the intro."""
    company = intro.company
    outcome = {
        "advanced": "we are taking it forward to the next stage",
        "passed": "we have decided not to invest this time, and have told the founder personally",
    }.get(company.status, "we have been in touch with the founder and are reviewing it now")
    return ReplyDraft(
        kind="introducer_thanks",
        recipient_name=intro.introducer_name,
        recipient_address="",
        subject=f"Thank you for introducing {company.name}",
        body=(
            f"Hi {_first_name(intro.introducer_name)},\n\n"
            f"Thank you for introducing us to {company.name}. A quick update: {outcome}. "
            "We really appreciate you thinking of us.\n\n"
            f"Best regards,\n{intro.recipient}\nSkarv Ventures"
        ),
    )


def send_reply(company, draft: ReplyDraft, sent_by: str, intro=None):
    """Simulated send: store the message and log the click. Nothing is delivered.

    Sending an intro reply also marks the intro as replied.
    """
    from Inputs.OutboxMessage import OutboxMessage

    if not draft.body.strip() or not draft.subject.strip():
        raise ActionRefused("A reply needs a subject and a message.")
    if not sent_by:
        raise ActionRefused("A reply needs the name of the person sending it.")
    with transaction.atomic():
        message = OutboxMessage.objects.create(
            company=company,
            company_name=company.name,
            kind=draft.kind,
            recipient_name=draft.recipient_name,
            recipient_address=draft.recipient_address,
            subject=draft.subject,
            body=draft.body,
            sent_by=sent_by,
            sent_at=timezone.now(),
        )
        log_decision(
            company,
            "message_sent",
            sent_by,
            comment=f"{draft.kind} to {draft.recipient_name or 'recipient'} (simulated send)",
        )
        if intro is not None and draft.kind == "intro_reply":
            intro.intro_status = "replied"
            intro.intro_replied_at = demo_today()
            intro.save()
    return message


def pass_and_reply(company, pass_code: str, sent_by: str, comment: str, draft: ReplyDraft) -> None:
    """Pass on the deal and send the (edited) pass reply in one click — both logged."""
    from Uploads._triage_actions import pass_deal

    with transaction.atomic():
        pass_deal(company, pass_code, sent_by, comment=comment)
        send_reply(company, draft, sent_by)
