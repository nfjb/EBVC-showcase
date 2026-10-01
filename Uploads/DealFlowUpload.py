"""DealFlowUpload — upload the inbound CSV and signals CSV and run the triage pipeline.

calculate() rebuilds the CRM from the two files: merge records into companies and
touchpoints, queue fuzzy matches as suggested merges, apply the hard filters and score
every company. The work itself lives in ``Uploads/_pipeline.py``.
"""

from django.db import models
from lex.core.models.CalculationModel import CalculationModel


class DealFlowUpload(CalculationModel):
    id = models.AutoField(primary_key=True)
    inbound_file = models.FileField(upload_to="dealflow_uploads")
    signals_file = models.FileField(upload_to="dealflow_uploads")
    raw_record_count = models.IntegerField(default=0)
    company_count = models.IntegerField(default=0)
    suggested_merge_count = models.IntegerField(default=0)
    passed_filter_count = models.IntegerField(default=0)

    def calculate(self):
        from Uploads._pipeline import run_pipeline

        if not self.inbound_file or not self.signals_file:
            raise ValueError("Upload both the inbound CSV and the signals CSV.")
        with self.inbound_file.open("rb") as inbound, self.signals_file.open("rb") as signals:
            counts = run_pipeline(inbound, signals)
        self.raw_record_count = counts["raw_records"]
        self.company_count = counts["companies"]
        self.suggested_merge_count = counts["suggested_merges"]
        self.passed_filter_count = counts["passed_filters"]
