"""Smoke tests: the models persist and DealFlowUpload.calculate() refuses missing files."""

import pytest

from Inputs.Company import Company
from Uploads.DealFlowUpload import DealFlowUpload

pytestmark = pytest.mark.integration


def test_company_roundtrip():
    company = Company.objects.create(name="Smoke Test Company", country="DK", stage="Seed")
    assert Company.objects.get(pk=company.pk).name == "Smoke Test Company"
    company.delete()


def test_calculate_refuses_an_upload_without_files():
    upload = DealFlowUpload()
    with pytest.raises(ValueError):
        upload.calculate()
