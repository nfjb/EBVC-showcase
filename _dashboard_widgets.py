"""Shared building blocks for the dashboard pages: navigation, feedback, labels, data.

Status is always a text label; the icon in front only reinforces it (WCAG: never colour
or icon alone). Colours come from Streamlit's default theme, which meets AA contrast.
"""

import datetime
from functools import lru_cache

import streamlit as st
import yaml

from Uploads._scoring import queue_flag
from Uploads._triage_actions import ActionRefused, days_in_queue
from Uploads._triage_config import PROJECT_ROOT, demo_today, load_triage_config
from Uploads._working_days import ESCALATED, REMINDER_TO_OWNER, intro_reply_state

DECISION_LABELS = {
    "open": "◻ Open",
    "advanced": "✅ Advanced",
    "passed": "⛔ Passed",
}
INTRO_LABELS = {"open": "◻ Awaiting reply", "replied": "✅ Replied", "closed": "▪ Closed"}
CHANNEL_LABELS = {
    "website_form": "Website form",
    "cold_email": "Cold email",
    "linkedin": "LinkedIn",
    "warm_intro": "Warm intro",
}
INTRODUCER_LABELS = {"LP": "LP", "portfolio_founder": "Portfolio founder", "angel": "Angel"}
PASS_CODE_LABELS = {
    "outside_stage": "Outside stage",
    "outside_geography": "Outside geography",
    "ticket_mismatch": "Ticket mismatch",
    "outside_thesis": "Outside thesis",
    "market_too_small": "Market too small",
    "portfolio_conflict": "Portfolio conflict",
    "too_early_revisit_6m": "Too early, revisit in 6 months",
    "other": "Other (comment required)",
}


# ── navigation ────────────────────────────────────────────────────────────────────


def go_to(page: str, company_id: int | None = None) -> None:
    """Switch page (and optionally the deal shown on Deal detail) on the next run.

    The target is parked in ``next_page`` and applied by ``main()`` before the sidebar
    navigation is drawn: Streamlit refuses changes to a widget's value after it is drawn.
    """
    current = st.session_state.get("page", "Cockpit")
    if page == "Deal detail" and current != "Deal detail":
        st.session_state["deal_return_page"] = current
    st.session_state["next_page"] = page
    if company_id is not None:
        st.session_state["selected_company_id"] = company_id


def remember_deal_list(title: str, company_ids: list[int]) -> None:
    """The list a deal is opened from, so Deal detail can step through it."""
    st.session_state["deal_sequence"] = list(company_ids)
    st.session_state["deal_sequence_title"] = title


def link_button(label: str, page: str, company_id: int | None = None, key: str = "") -> None:
    st.button(
        label,
        key=key or f"go-{page}-{company_id}-{label}",
        on_click=go_to,
        args=(page, company_id),
        type="tertiary",
    )


def page_header(title: str, caption: str = "") -> None:
    st.title(title)
    if caption:
        st.caption(caption)
    show_flash()


# ── feedback after a click ────────────────────────────────────────────────────────


def show_flash() -> None:
    """Show the message the previous click left behind, once."""
    message = st.session_state.pop("flash", None)
    if message:
        st.success(message, icon="✅")


def run_action(action, *arguments, success: str, **keyword_arguments) -> bool:
    """Run a human action; on success keep a message for the next run and rerun."""
    try:
        action(*arguments, **keyword_arguments)
    except ActionRefused as refusal:
        st.error(f"Not saved: {refusal}", icon="⚠️")
        return False
    st.session_state["flash"] = success
    st.rerun()
    return True


# ── formatting ────────────────────────────────────────────────────────────────────


def euros(amount: float | None) -> str:
    return "–" if amount is None else f"EUR {amount / 1_000_000:.2f}m"


def rating(value: int | None) -> str:
    return "–" if value is None else str(value)


def long_date(day: datetime.date) -> str:
    return f"{day:%a} {day.day} {day:%b}"


def maximum_score() -> float:
    """Every component at 3 — the ceiling for the score bar."""
    weights = load_triage_config()["weights"]
    return round(sum(float(weight) * 3 for weight in weights.values()), 2)


# ── data helpers ──────────────────────────────────────────────────────────────────


@lru_cache(maxsize=1)
def responsible_partners() -> dict[str, str]:
    with open(PROJECT_ROOT / "config" / "team.yaml", encoding="utf-8") as team_file:
        team = yaml.safe_load(team_file)["team"]
    return {member["name"]: member["responsible_partner"] for member in team}


def intro_states(today: datetime.date | None = None) -> list[tuple]:
    """Every warm intro with its reply deadline and escalation step."""
    from Inputs.Touchpoint import Touchpoint

    today = today or demo_today()
    reply_days = load_triage_config()["intro_reply_working_days"]
    intros = Touchpoint.objects.filter(channel="warm_intro").select_related("company")
    return [(intro, intro_reply_state(intro.received_at, today, reply_days)) for intro in intros]


def intro_urgency(intro, state: dict) -> str:
    """Plain-language state of one intro, with a leading icon."""
    if intro.intro_status != "open":
        return INTRO_LABELS[intro.intro_status]
    if state["past_deadline"]:
        return f"⚠️ Overdue since {long_date(state['deadline'])}, escalated to partner"
    if state["escalation"] == ESCALATED:
        return "⚠️ Due today, escalated to partner"
    if state["escalation"] == REMINDER_TO_OWNER:
        return f"⏰ Due {long_date(state['deadline'])}, reminder sent to owner"
    return f"◻ Due {long_date(state['deadline'])}"


def queue_state(company) -> tuple[int, str]:
    waiting = days_in_queue(company)
    return waiting, queue_flag(waiting, load_triage_config()["queue_flags"])


def needs_rating(company) -> bool:
    return not company.thesis_fit_confirmed or company.market is None or company.team is None
