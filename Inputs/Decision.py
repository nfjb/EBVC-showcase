"""Decision — the audit log of human clicks (spec §8).

Every advance / pass decision, rank override and merge approval is written here with
who, when, the decision and its pass code. Nothing in the pipeline writes a Decision on
its own: each row comes from a person clicking a button.

The log outlives the company row: a re-upload rebuilds the CRM and an approved merge
deletes the merged-away company, so ``company`` is set to NULL rather than cascading and
``company_name`` keeps the name the decision was made about.
"""

from django.db import models
from django.utils import timezone
from lex.core.models.LexModel import LexModel

from Inputs.Company import Company


class Decision(LexModel):
    id = models.AutoField(primary_key=True)
    company = models.ForeignKey(
        Company, on_delete=models.SET_NULL, null=True, blank=True, related_name="decisions"
    )
    company_name = models.CharField(max_length=255)
    # advance / pass / rank_override / merge_approved / merge_rejected / intro_replied /
    # thesis_confirmed / rating_changed
    decision = models.CharField(max_length=30)
    pass_code = models.CharField(max_length=50, blank=True, default="")
    comment = models.TextField(blank=True, default="")
    decided_by = models.CharField(max_length=255)
    decided_at = models.DateTimeField(default=timezone.now)

    def __str__(self) -> str:
        return f"{self.decision} · {self.company_name} · {self.decided_by}"
