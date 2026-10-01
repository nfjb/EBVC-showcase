"""Company scoring with visible weights and a per-deal breakdown (spec §4).

Only companies are scored. ``market`` and ``team`` are human-only ratings: an empty
rating adds nothing, and nothing here ever fills ``team``. Time in queue is not an input
to the score — it only raises the 14/21-day flags in :func:`queue_flag`.
"""

import re

SCORED_COMPONENTS = ("thesis_fit", "market", "team", "momentum", "source_quality")
MOMENTUM_SIGNAL_TYPES = {"senior_hire", "traction_update", "news"}

DECIDE_THIS_WEEK = "Decide this week"
DECISION_REQUIRED = "Decision required at next meeting"


def _mentions(text: str, keyword: str) -> bool:
    return re.search(rf"\b{re.escape(keyword)}\b", text) is not None


def suggest_thesis_fit(deck_text: str, keywords: dict[str, list[str]]) -> int:
    """Deterministic 1–3 suggestion from the deck text against config/thesis.md.

    3 = mentions a core thesis area, 2 = adjacent, 1 = outside or no match.
    Always a suggestion: a person confirms it before it counts as confirmed.
    """
    text = (deck_text or "").lower()
    if any(_mentions(text, keyword) for keyword in keywords["outside"]):
        return 1
    if any(_mentions(text, keyword) for keyword in keywords["strong"]):
        return 3
    if any(_mentions(text, keyword) for keyword in keywords["partial"]):
        return 2
    return 1


def momentum_from_signals(signal_types: list[str], cap: int) -> int:
    return min(cap, sum(1 for signal_type in signal_types if signal_type in MOMENTUM_SIGNAL_TYPES))


def source_quality_from_channels(channels: list[str], quality_by_channel: dict[str, int]) -> int:
    return max((quality_by_channel.get(channel, 0) for channel in channels), default=0)


def score_company(components: dict, weights: dict, thesis_fit_confirmed: bool = False):
    """Return ``(score, breakdown)``. Reads only the five scored components.

    ``components`` may carry any other company fields (days in queue, dates…); they are
    ignored, which is what keeps time in queue out of the score.
    """
    breakdown = []
    total = 0.0
    for component in SCORED_COMPONENTS:
        value = components.get(component)
        weight = float(weights[component])
        points = 0.0 if value is None else value * weight
        total += points
        if value is None:
            note = "Not yet rated (human only)"
        elif component == "thesis_fit":
            note = "Confirmed" if thesis_fit_confirmed else "Suggested, awaiting confirmation"
        else:
            note = ""
        breakdown.append(
            {
                "component": component,
                "value": value,
                "weight": weight,
                "points": points,
                "note": note,
            }
        )
    return round(total, 2), breakdown


def queue_flag(days_in_queue: int, flags: dict) -> str:
    if days_in_queue >= flags["decision_required_days"]:
        return DECISION_REQUIRED
    if days_in_queue >= flags["decide_this_week_days"]:
        return DECIDE_THIS_WEEK
    return ""
