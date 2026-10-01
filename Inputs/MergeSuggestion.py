"""MergeSuggestion — a fuzzy company-name match waiting for a person (spec §2).

Suggested merges are never applied silently: ``status`` stays ``pending`` until someone
approves (``candidate`` is folded into ``company``) or rejects it in the merge queue.
"""

from django.db import models
from lex.core.models.LexModel import LexModel

from Inputs.Company import Company


class MergeSuggestion(LexModel):
    id = models.AutoField(primary_key=True)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="merge_suggestions")
    candidate = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name="merge_candidate_for"
    )
    # Jaro-Winkler similarity of the normalised company names, 0–1.
    similarity = models.FloatField()
    # pending / approved / rejected
    status = models.CharField(max_length=20, default="pending")
    decided_by = models.CharField(max_length=255, blank=True, default="")
    decided_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return f"{self.company} ↔ {self.candidate} ({self.similarity:.2f})"
