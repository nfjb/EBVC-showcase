"""Company — one merged company in the Skarv CRM (one row per company, spec §2).

Companies are scored, never individuals (spec §4, §8): no field here rates a founder.
``market`` and ``team`` are human-only ratings and stay empty until a person fills them.
"""

from django.db import models
from lex.core.models.LexModel import LexModel


class Company(LexModel):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)
    website_domain = models.CharField(max_length=255, blank=True, default="")
    country = models.CharField(max_length=2, blank=True, default="")
    stage = models.CharField(max_length=50, blank=True, default="")
    round_size_eur = models.IntegerField(null=True, blank=True)
    one_liner = models.CharField(max_length=500, blank=True, default="")
    deck_text = models.TextField(blank=True, default="")
    first_seen_at = models.DateField(null=True, blank=True)
    touchpoint_count = models.IntegerField(default=0)
    # The person originally contacted (first touchpoint's recipient).
    owner = models.CharField(max_length=100, blank=True, default="")

    # open / advanced / passed
    status = models.CharField(max_length=20, default="open")
    passed_hard_filters = models.BooleanField(default=False)
    # Hard-filter failure (outside_stage / outside_geography / ticket_mismatch) or the
    # pass code a person chose when passing the deal.
    pass_code = models.CharField(max_length=50, blank=True, default="")

    # Score components (spec §4). thesis_fit is suggested until a person confirms it.
    thesis_fit = models.IntegerField(null=True, blank=True)
    thesis_fit_confirmed = models.BooleanField(default=False)
    market = models.IntegerField(null=True, blank=True)
    team = models.IntegerField(null=True, blank=True)
    momentum = models.IntegerField(default=0)
    source_quality = models.IntegerField(default=0)
    score = models.FloatField(default=0)
    # JSON list of {component, value, weight, points, note} — why the deal ranks where it does.
    score_breakdown = models.TextField(blank=True, default="[]")
    latest_signal = models.CharField(max_length=300, blank=True, default="")
    latest_signal_at = models.DateField(null=True, blank=True)

    # Manual rank override; the required comment is also written to the Decision audit log.
    rank_override = models.IntegerField(null=True, blank=True)
    rank_override_comment = models.TextField(blank=True, default="")

    def __str__(self) -> str:
        return self.name
