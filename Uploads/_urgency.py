"""Urgency, cockpit priority, open tasks and the next action for a company.

priority = score % × urgency. Urgency comes only from obligations and news (an open warm
intro's reply-deadline stage, how recent the latest signal is) and never from days in
queue: waiting longer only raises the 14/21-day flag (user decision 2026-09-30).
"""

import datetime
from dataclasses import dataclass, field

from Uploads._scoring import DECISION_REQUIRED, queue_flag
from Uploads._triage_config import demo_today, load_triage_config
from Uploads._working_days import ESCALATED, REMINDER_TO_OWNER, intro_reply_state


def maximum_score() -> float:
    weights = load_triage_config()["weights"]
    return sum(float(weight) * 3 for weight in weights.values())


def score_percent(score: float) -> int:
    return round(100 * score / maximum_score())


def open_intro(company):
    """The company's open warm intro (the most recent one), or None."""
    intros = [
        touchpoint
        for touchpoint in company.touchpoints.all()
        if touchpoint.channel == "warm_intro" and touchpoint.intro_status == "open"
    ]
    return max(intros, key=lambda touchpoint: touchpoint.received_at, default=None)


def intro_state(intro, today: datetime.date) -> dict | None:
    if intro is None:
        return None
    reply_days = load_triage_config()["intro_reply_working_days"]
    return intro_reply_state(intro.received_at, today, reply_days)


def urgency(
    latest_signal_at: datetime.date | None, state: dict | None, today: datetime.date
) -> int:
    """0–100 from the intro deadline stage and signal recency. No queue-age input."""
    rules = load_triage_config()["urgency"]
    if state is not None:
        if state["past_deadline"]:
            return rules["intro_overdue"]
        if state["escalation"] == ESCALATED:
            return rules["intro_due_today"]
        if state["escalation"] == REMINDER_TO_OWNER:
            return rules["intro_reminder"]
        return rules["intro_open"]
    value = rules["base"]
    if latest_signal_at is not None:
        age = (today - latest_signal_at).days
        if age <= rules["recent_signal_days"]:
            value += rules["recent_signal_bonus"]
        elif age <= rules["signal_days"]:
            value += rules["signal_bonus"]
    return min(value, 100)


@dataclass
class CockpitLine:
    """Everything the cockpit shows for one company."""

    company: object
    score_percent: int
    urgency: int
    priority: float
    days_in_queue: int
    flag: str
    intro: object = None
    intro_state: dict | None = None
    tasks: list[str] = field(default_factory=list)
    next_action: str = ""
    next_action_kind: str = "deal"  # deal / intro / pass_draft / merge
    urgent: bool = False


def needs_rating(company) -> bool:
    return not company.thesis_fit_confirmed or company.market is None or company.team is None


def build_line(
    company,
    today: datetime.date | None = None,
    pending_merge_ids=frozenset(),
    pass_reply_sent_ids=frozenset(),
) -> CockpitLine:
    today = today or demo_today()
    config = load_triage_config()
    intro = open_intro(company)
    state = intro_state(intro, today)
    waiting = (today - company.first_seen_at).days if company.first_seen_at else 0
    flag = queue_flag(waiting, config["queue_flags"])
    percent = score_percent(company.score)
    urgency_value = urgency(company.latest_signal_at, state, today)
    line = CockpitLine(
        company=company,
        score_percent=percent,
        urgency=urgency_value,
        priority=round(percent * urgency_value / 100, 1),
        days_in_queue=waiting,
        flag=flag,
        intro=intro,
        intro_state=state,
    )

    if state is not None:
        label = {"LP": "LP", "portfolio_founder": "Portfolio", "angel": "Angel"}.get(
            intro.introducer_type, "Warm"
        )
        line.tasks.append("Reply to warm intro")
        if state["past_deadline"]:
            line.next_action = f"{label} intro reply · overdue"
        else:
            line.next_action = f"{label} intro reply · {state['deadline']:%a}"
        line.next_action_kind = "intro"
        line.urgent = True
    if company.pk in pending_merge_ids:
        line.tasks.append("Confirm possible duplicate")
    if company.status == "open" and not company.passed_hard_filters:
        if company.pk not in pass_reply_sent_ids:
            line.tasks.append("Approve pass draft")
    elif company.status == "open" and needs_rating(company):
        line.tasks.append("Rate thesis, market and team")
    if company.status == "open" and company.passed_hard_filters and flag:
        line.tasks.append(flag)

    if not line.next_action:
        if "Approve pass draft" in line.tasks:
            line.next_action, line.next_action_kind = "Approve pass draft", "pass_draft"
        elif "Confirm possible duplicate" in line.tasks:
            line.next_action, line.next_action_kind = "Confirm duplicate", "merge"
        elif flag == DECISION_REQUIRED:
            line.next_action, line.urgent = "Decide at next meeting", True
        elif flag:
            line.next_action = "Decide this week"
        elif "Rate thesis, market and team" in line.tasks:
            line.next_action = "Rate the deal"
        elif company.status == "open":
            line.next_action = "Decide: advance or pass"
        else:
            line.next_action = "Open deal"
    return line


def rank_by_priority(lines: list[CockpitLine]) -> list[CockpitLine]:
    """Highest score % × urgency first; ranks pinned by a person keep their position."""
    pinned = sorted(
        (line for line in lines if line.company.rank_override),
        key=lambda line: line.company.rank_override,
    )
    ranked = sorted(
        (line for line in lines if not line.company.rank_override),
        key=lambda line: (-line.priority, -line.score_percent, line.company.name),
    )
    for line in pinned:
        ranked.insert(min(line.company.rank_override, len(ranked) + 1) - 1, line)
    return ranked


QUADRANTS = {
    "act_now": ("Act now", "High score, urgent: reply and decide this week."),
    "plan": ("Plan a deep dive", "High score, no deadline: schedule a proper look."),
    "reply_fast": ("Reply fast", "Urgent obligation, weaker fit: answer quickly, then decide."),
    "park": ("Park or pass", "Weaker fit, nothing pressing: pass with a reason or revisit later."),
}


def quadrant(score_percent_value: int, urgency_value: int) -> str:
    """Which of the four matrix quadrants a deal falls in (config/weights.yaml → matrix)."""
    splits = load_triage_config()["matrix"]
    high_score = score_percent_value >= splits["score_split"]
    urgent = urgency_value >= splits["urgency_split"]
    if high_score and urgent:
        return "act_now"
    if high_score:
        return "plan"
    if urgent:
        return "reply_fast"
    return "park"
