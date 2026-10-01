"""Touchpoint — one original inbound record, kept exactly as it arrived (spec §2).

Warm intros are tracked here too (spec §5, Lane A): ``intro_status`` is open / replied /
closed for a warm intro and empty for every other channel.
"""

from django.db import models
from lex.core.models.LexModel import LexModel

from Inputs.Company import Company


class Touchpoint(LexModel):
    id = models.AutoField(primary_key=True)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="touchpoints")
    record_id = models.CharField(max_length=50)
    # website_form / cold_email / linkedin / warm_intro
    channel = models.CharField(max_length=20)
    received_at = models.DateField()
    recipient = models.CharField(max_length=100, blank=True, default="")
    company_name = models.CharField(max_length=255)
    website = models.CharField(max_length=255, blank=True, default="")
    founder_name = models.CharField(max_length=255, blank=True, default="")
    founder_email = models.CharField(max_length=255, blank=True, default="")
    founder_linkedin = models.CharField(max_length=255, blank=True, default="")
    country = models.CharField(max_length=2, blank=True, default="")
    stage = models.CharField(max_length=50, blank=True, default="")
    round_size_eur = models.IntegerField(null=True, blank=True)
    one_liner = models.CharField(max_length=500, blank=True, default="")
    deck_text = models.TextField(blank=True, default="")
    introducer_name = models.CharField(max_length=255, blank=True, default="")
    # LP / portfolio_founder / angel / none
    introducer_type = models.CharField(max_length=30, blank=True, default="none")
    intro_status = models.CharField(max_length=20, blank=True, default="")
    intro_replied_at = models.DateField(null=True, blank=True)

    def __str__(self) -> str:
        return f"{self.company_name} · {self.channel} · {self.received_at}"
