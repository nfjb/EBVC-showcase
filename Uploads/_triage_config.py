"""Loads ``config/weights.yaml`` and the thesis keywords from ``config/thesis.md``."""

import datetime
import re
from functools import lru_cache
from pathlib import Path

import yaml

PROJECT_ROOT = Path(__file__).resolve().parent.parent
WEIGHTS_PATH = PROJECT_ROOT / "config" / "weights.yaml"
THESIS_PATH = PROJECT_ROOT / "config" / "thesis.md"


@lru_cache(maxsize=1)
def load_triage_config() -> dict:
    with open(WEIGHTS_PATH, encoding="utf-8") as config_file:
        return yaml.safe_load(config_file)


def demo_today() -> datetime.date:
    value = load_triage_config()["demo_today"]
    if isinstance(value, datetime.date):
        return value
    return datetime.date.fromisoformat(str(value))


@lru_cache(maxsize=1)
def load_thesis_keywords() -> dict[str, list[str]]:
    """Return the ``strong`` / ``partial`` / ``outside`` keyword lists from thesis.md."""
    thesis_text = THESIS_PATH.read_text(encoding="utf-8")
    keywords = {}
    for level in ("strong", "partial", "outside"):
        match = re.search(rf"^\s*{level}:\s*(.+)$", thesis_text, flags=re.MULTILINE)
        words = match.group(1).split(",") if match else []
        keywords[level] = [word.strip().lower() for word in words if word.strip()]
    return keywords
