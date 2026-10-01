"""Hard filters: stage, geography and ticket fit (spec §3)."""

OUTSIDE_STAGE = "outside_stage"
OUTSIDE_GEOGRAPHY = "outside_geography"
TICKET_MISMATCH = "ticket_mismatch"


def implied_ticket_eur(round_size_eur: int | None, rules: dict) -> float | None:
    """Skarv's implied ticket = round size × ``implied_ticket_share`` (40 % by default)."""
    if round_size_eur is None:
        return None
    return round_size_eur * rules["implied_ticket_share"]


def hard_filter_pass_code(stage: str, country: str, round_size_eur: int | None, rules: dict) -> str:
    """Return the first failing pass code, or ``""`` when the company passes every filter."""
    if stage not in rules["stages"]:
        return OUTSIDE_STAGE
    allowed_countries = {code for region in rules["countries"].values() for code in region}
    if country not in allowed_countries:
        return OUTSIDE_GEOGRAPHY
    ticket = implied_ticket_eur(round_size_eur, rules)
    if ticket is None or not rules["ticket_min_eur"] <= ticket <= rules["ticket_max_eur"]:
        return TICKET_MISMATCH
    return ""
