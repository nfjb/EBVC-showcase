"""Domain, email, LinkedIn and company-name normalisation (spec §2, §10)."""

import pytest

from Uploads._normalise import (
    normalise_company_name,
    normalise_domain,
    normalise_email,
    normalise_linkedin,
)

pytestmark = pytest.mark.unit


@pytest.mark.parametrize(
    "website",
    [
        "robotix.ai",
        "https://robotix.ai",
        "http://www.robotix.ai/",
        "https://WWW.Robotix.AI/about/team?ref=x",
        "www.robotix.ai//",
        " robotix.ai:443/ ",
    ],
)
def test_domain_variants_normalise_to_the_same_domain(website):
    assert normalise_domain(website) == "robotix.ai"


def test_empty_domain_stays_empty():
    assert normalise_domain("") == ""
    assert normalise_domain(None) == ""


def test_email_is_lowercased_and_trimmed():
    assert normalise_email("  Anna.Berg@Robotix.AI ") == "anna.berg@robotix.ai"


@pytest.mark.parametrize(
    "url",
    [
        "https://www.linkedin.com/in/anna-berg/",
        "linkedin.com/in/Anna-Berg",
        "http://linkedin.com/in/anna-berg?utm_source=share",
    ],
)
def test_linkedin_variants_normalise_to_the_same_profile(url):
    assert normalise_linkedin(url) == "linkedin.com/in/anna-berg"


@pytest.mark.parametrize(
    "name",
    ["Robotix AI", "Robotix", "RobotiX GmbH", "Robotix Labs AB", "Robotix, Ltd."],
)
def test_company_name_strips_legal_suffixes_and_noise_tokens(name):
    assert normalise_company_name(name) == "robotix"


def test_company_name_keeps_meaningful_words():
    assert normalise_company_name("Nordic Grid Oy") == "nordic grid"


def test_company_name_made_only_of_noise_is_not_emptied():
    assert normalise_company_name("AI Labs") == "ai labs"
