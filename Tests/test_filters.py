"""Hard filters on stage, geography and ticket fit (spec §3, §10).

Ticket rule (user decision 2026-09-30): implied ticket = 40 % of the round, which must be
within EUR 0.5–2m, so rounds of EUR 1.25m–5m pass.
"""

import pytest

from Uploads._filters import (
    OUTSIDE_GEOGRAPHY,
    OUTSIDE_STAGE,
    TICKET_MISMATCH,
    hard_filter_pass_code,
)
from Uploads._triage_config import load_triage_config

pytestmark = pytest.mark.unit

RULES = load_triage_config()["hard_filters"]


@pytest.mark.parametrize("stage", ["Pre-Seed", "Seed"])
@pytest.mark.parametrize("country", ["DK", "SE", "NO", "FI", "IS", "DE", "AT", "CH"])
def test_in_scope_stage_and_country_pass(stage, country):
    assert hard_filter_pass_code(stage, country, 3_000_000, RULES) == ""


@pytest.mark.parametrize("stage", ["Series A", "Series B", "Growth", ""])
def test_other_stages_fail_as_outside_stage(stage):
    assert hard_filter_pass_code(stage, "DK", 3_000_000, RULES) == OUTSIDE_STAGE


@pytest.mark.parametrize("country", ["US", "GB", "FR", "NL", ""])
def test_countries_outside_nordics_and_dach_fail(country):
    assert hard_filter_pass_code("Seed", country, 3_000_000, RULES) == OUTSIDE_GEOGRAPHY


@pytest.mark.parametrize("round_size", [1_250_000, 5_000_000])
def test_ticket_range_boundaries_are_inclusive(round_size):
    assert hard_filter_pass_code("Seed", "DE", round_size, RULES) == ""


@pytest.mark.parametrize("round_size", [1_000_000, 6_000_000, None])
def test_rounds_implying_a_ticket_outside_range_fail(round_size):
    assert hard_filter_pass_code("Seed", "DE", round_size, RULES) == TICKET_MISMATCH


def test_stage_is_checked_before_geography_and_ticket():
    assert hard_filter_pass_code("Series B", "US", 50_000_000, RULES) == OUTSIDE_STAGE
