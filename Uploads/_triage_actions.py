"""Human actions behind the dashboard buttons (spec §4, §5, §8).

Every function here is called from a person's click and writes a Decision row (who,
when, decision, pass code). None of them is called by the pipeline.
"""

import datetime
import json

from django.db import transaction
from django.utils import timezone

from Uploads._scoring import score_company, source_quality_from_channels
from Uploads._triage_config import demo_today, load_triage_config

PASS_CODES = [
    "outside_stage",
    "outside_geography",
    "ticket_mismatch",
    "outside_thesis",
    "market_too_small",
    "portfolio_conflict",
    "too_early_revisit_6m",
    "other",
]
INTRO_STATUSES = ["open", "replied", "closed"]


class ActionRefused(ValueError):
    """A click that is missing something the rules require (for example a comment)."""


def log_decision(company, decision: str, decided_by: str, pass_code: str = "", comment: str = ""):
    from Inputs.Decision import Decision

    if not decided_by:
        raise ActionRefused("A decision needs the name of the person making it.")
    return Decision.objects.create(
        company=company,
        company_name=company.name,
        decision=decision,
        pass_code=pass_code,
        comment=comment,
        decided_by=decided_by,
        decided_at=timezone.now(),
    )


def rescore(company) -> None:
    """Recompute score and breakdown from the stored components (never from queue time)."""
    config = load_triage_config()
    components = {
        "thesis_fit": company.thesis_fit,
        "market": company.market,
        "team": company.team,
        "momentum": company.momentum,
        "source_quality": company.source_quality,
    }
    company.score, breakdown = score_company(
        components, config["weights"], thesis_fit_confirmed=company.thesis_fit_confirmed
    )
    company.score_breakdown = json.dumps(breakdown)


def _check_rating(value: int | None, label: str) -> None:
    if value is not None and value not in (1, 2, 3):
        raise ActionRefused(f"{label} must be 1, 2 or 3.")


def save_ratings(
    company, thesis_fit: int, market: int | None, team: int | None, decided_by: str
) -> None:
    """A person confirms thesis fit and rates market and team (team is only ever set here)."""
    for value, label in ((thesis_fit, "Thesis fit"), (market, "Market"), (team, "Team")):
        _check_rating(value, label)
    with transaction.atomic():
        company.thesis_fit = thesis_fit
        company.thesis_fit_confirmed = True
        company.market = market
        company.team = team
        rescore(company)
        company.save()
        log_decision(
            company,
            "rating_changed",
            decided_by,
            comment=f"thesis fit {thesis_fit} (confirmed), market {market or '-'}, team {team or '-'}",
        )


def advance(company, decided_by: str, comment: str = "") -> None:
    with transaction.atomic():
        company.status = "advanced"
        company.save()
        log_decision(company, "advance", decided_by, comment=comment)


def pass_deal(company, pass_code: str, decided_by: str, comment: str = "") -> None:
    if pass_code not in PASS_CODES:
        raise ActionRefused(f"Unknown pass code: {pass_code}.")
    if pass_code == "other" and not comment.strip():
        raise ActionRefused("Pass code 'other' needs a comment.")
    with transaction.atomic():
        company.status = "passed"
        company.pass_code = pass_code
        company.save()
        log_decision(company, "pass", decided_by, pass_code=pass_code, comment=comment)


def override_rank(company, rank: int | None, comment: str, decided_by: str) -> None:
    """Pin a company to a worklist position (or clear the pin). A comment is required."""
    if not comment.strip():
        raise ActionRefused("A rank override needs a comment.")
    if rank is not None and rank < 1:
        raise ActionRefused("Rank must be 1 or higher.")
    with transaction.atomic():
        company.rank_override = rank
        company.rank_override_comment = comment
        company.save()
        log_decision(
            company,
            "rank_override",
            decided_by,
            comment=f"rank {rank if rank is not None else 'cleared'}: {comment}",
        )


def approve_merge(suggestion, decided_by: str) -> None:
    """Fold ``candidate`` into ``company``: move its touchpoints, then delete it."""
    from Inputs.Touchpoint import Touchpoint

    config = load_triage_config()
    company, candidate = suggestion.company, suggestion.candidate
    with transaction.atomic():
        suggestion.status = "approved"
        suggestion.decided_by = decided_by
        suggestion.decided_at = timezone.now()
        suggestion.save()
        log_decision(
            company,
            "merge_approved",
            decided_by,
            comment=f"merged '{candidate.name}' (similarity {suggestion.similarity:.2f})",
        )
        Touchpoint.objects.filter(company=candidate).update(company=company)
        touchpoints = Touchpoint.objects.filter(company=company)
        company.touchpoint_count = touchpoints.count()
        company.first_seen_at = min(touchpoint.received_at for touchpoint in touchpoints)
        company.source_quality = source_quality_from_channels(
            [touchpoint.channel for touchpoint in touchpoints], config["source_quality"]
        )
        company.momentum = max(company.momentum, candidate.momentum)
        company.website_domain = company.website_domain or candidate.website_domain
        rescore(company)
        company.save()
        candidate.delete()


def reject_merge(suggestion, decided_by: str) -> None:
    with transaction.atomic():
        suggestion.status = "rejected"
        suggestion.decided_by = decided_by
        suggestion.decided_at = timezone.now()
        suggestion.save()
        log_decision(
            suggestion.company,
            "merge_rejected",
            decided_by,
            comment=f"kept '{suggestion.candidate.name}' separate",
        )


def set_intro_status(touchpoint, status: str, decided_by: str) -> None:
    if status not in INTRO_STATUSES:
        raise ActionRefused(f"Unknown intro status: {status}.")
    with transaction.atomic():
        touchpoint.intro_status = status
        touchpoint.intro_replied_at = demo_today() if status == "replied" else None
        touchpoint.save()
        log_decision(
            touchpoint.company,
            "intro_replied" if status == "replied" else f"intro_{status}",
            decided_by,
            comment=f"intro from {touchpoint.introducer_name}",
        )


def days_in_queue(company, today: datetime.date | None = None) -> int:
    today = today or demo_today()
    return (today - company.first_seen_at).days if company.first_seen_at else 0


def rank_worklist(companies: list) -> list:
    """Open, filter-passing companies ordered by score % × urgency; pinned ranks override.

    Urgency never includes time in queue (see ``Uploads/_urgency.py``).
    """
    from Uploads._urgency import build_line, rank_by_priority

    candidates = [
        company for company in companies if company.status == "open" and company.passed_hard_filters
    ]
    return [
        line.company for line in rank_by_priority([build_line(company) for company in candidates])
    ]
