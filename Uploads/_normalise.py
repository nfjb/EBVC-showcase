"""Normalisation of domains, emails, LinkedIn URLs and company names for matching."""

import re

LEGAL_SUFFIXES = {
    "gmbh",
    "ab",
    "aps",
    "as",
    "oy",
    "ag",
    "ltd",
    "limited",
    "inc",
    "sa",
    "bv",
    "oyj",
    "asa",
}
NOISE_TOKENS = {"labs", "lab", "ai", "technologies", "technology", "tech", "hq", "the"}


def normalise_domain(website: str | None) -> str:
    """``https://www.Robotix.ai/about/`` → ``robotix.ai``."""
    if not website:
        return ""
    domain = website.strip().lower()
    domain = re.sub(r"^[a-z]+://", "", domain)
    domain = domain.split("/")[0].split("?")[0].split("#")[0]
    domain = domain.split(":")[0]
    if domain.startswith("www."):
        domain = domain[len("www.") :]
    return domain.strip(".")


def normalise_email(email: str | None) -> str:
    return (email or "").strip().lower()


def normalise_linkedin(url: str | None) -> str:
    """``https://www.linkedin.com/in/Anna-Berg/?utm=x`` → ``linkedin.com/in/anna-berg``."""
    if not url:
        return ""
    linkedin = url.strip().lower()
    linkedin = re.sub(r"^[a-z]+://", "", linkedin)
    linkedin = linkedin.split("?")[0].split("#")[0]
    if linkedin.startswith("www."):
        linkedin = linkedin[len("www.") :]
    return linkedin.rstrip("/")


def normalise_company_name(name: str | None) -> str:
    """``RobotiX GmbH`` / ``Robotix AI`` / ``Robotix`` → ``robotix``."""
    if not name:
        return ""
    lowered = re.sub(r"[^\w\s]", " ", name.lower())
    tokens = [
        token
        for token in lowered.split()
        if token not in LEGAL_SUFFIXES and token not in NOISE_TOKENS
    ]
    # A name made only of noise ("AI Labs") keeps its words rather than becoming empty.
    return " ".join(tokens) or " ".join(lowered.split())
