"""The triage pipeline behind DealFlowUpload.calculate() (spec §2–§4).

capture (the two CSVs) → merge → CRM store (companies + touchpoints) → hard filters →
enrichment (signals known at intake) → scoring. Signals dated after a company's last
arrival are left for the weekly freshness re-check, which is not part of the MVP.
"""

import datetime
import json

import pandas as pd
from lex.audit_logging.handlers.LexLogger import LexLogger

from Uploads._dedup import find_suggested_merges, group_records
from Uploads._filters import hard_filter_pass_code
from Uploads._normalise import normalise_domain
from Uploads._scoring import (
    momentum_from_signals,
    score_company,
    source_quality_from_channels,
    suggest_thesis_fit,
)
from Uploads._triage_config import load_thesis_keywords, load_triage_config


def read_csv(file) -> list[dict]:
    frame = pd.read_csv(file, dtype=str, keep_default_na=False)
    return frame.to_dict("records")


def to_int(value: str) -> int | None:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def latest_value(records: list[dict], field: str) -> str:
    """The most recent non-empty value of ``field`` across a company's records."""
    for record in sorted(records, key=lambda record: record["received_at"], reverse=True):
        if record.get(field):
            return record[field]
    return ""


def signals_by_domain(signal_rows: list[dict]) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = {}
    for signal in signal_rows:
        grouped.setdefault(normalise_domain(signal.get("website")), []).append(signal)
    return grouped


def describe_signal(signal: dict) -> str:
    event_date = datetime.date.fromisoformat(signal["event_date"])
    return f"{signal['description']} ({event_date.strftime('%b %Y')})"


def build_company_fields(records: list[dict], known_signals: list[dict], config: dict) -> dict:
    """Company-level fields for one group of records (the same company)."""
    first = min(records, key=lambda record: record["received_at"])
    stage = latest_value(records, "stage")
    country = latest_value(records, "country")
    round_size_eur = to_int(latest_value(records, "round_size_eur"))
    deck_text = latest_value(records, "deck_text")
    pass_code = hard_filter_pass_code(stage, country, round_size_eur, config["hard_filters"])
    components = {
        "thesis_fit": suggest_thesis_fit(deck_text, load_thesis_keywords()),
        "market": None,
        "team": None,
        "momentum": momentum_from_signals(
            [signal["signal_type"] for signal in known_signals], config["momentum_cap"]
        ),
        "source_quality": source_quality_from_channels(
            [record["channel"] for record in records], config["source_quality"]
        ),
    }
    score, breakdown = score_company(components, config["weights"])
    latest_signal = max(known_signals, key=lambda signal: signal["event_date"], default=None)
    return {
        "name": first["company_name"],
        "website_domain": next(
            (normalise_domain(record["website"]) for record in records if record.get("website")), ""
        ),
        "country": country,
        "stage": stage,
        "round_size_eur": round_size_eur,
        "one_liner": latest_value(records, "one_liner"),
        "deck_text": deck_text,
        "first_seen_at": datetime.date.fromisoformat(first["received_at"]),
        "touchpoint_count": len(records),
        "owner": first.get("recipient", ""),
        "status": "open",
        "passed_hard_filters": pass_code == "",
        "pass_code": pass_code,
        "thesis_fit": components["thesis_fit"],
        "momentum": components["momentum"],
        "source_quality": components["source_quality"],
        "score": score,
        "score_breakdown": json.dumps(breakdown),
        "latest_signal": describe_signal(latest_signal) if latest_signal else "",
        "latest_signal_at": (
            datetime.date.fromisoformat(latest_signal["event_date"]) if latest_signal else None
        ),
    }


def touchpoint_fields(record: dict) -> dict:
    is_intro = record["channel"] == "warm_intro"
    return {
        "record_id": record["record_id"],
        "channel": record["channel"],
        "received_at": datetime.date.fromisoformat(record["received_at"]),
        "recipient": record.get("recipient", ""),
        "company_name": record["company_name"],
        "website": record.get("website", ""),
        "founder_name": record.get("founder_name", ""),
        "founder_email": record.get("founder_email", ""),
        "founder_linkedin": record.get("founder_linkedin", ""),
        "country": record.get("country", ""),
        "stage": record.get("stage", ""),
        "round_size_eur": to_int(record.get("round_size_eur", "")),
        "one_liner": record.get("one_liner", ""),
        "deck_text": record.get("deck_text", ""),
        "introducer_name": record.get("introducer_name", ""),
        "introducer_type": record.get("introducer_type") or "none",
        "intro_status": "open" if is_intro else "",
    }


def clear_crm() -> None:
    """The upload is the CRM's source of truth, so a run rebuilds it from scratch.

    The Decision audit log and the Outbox are kept: their company link is set to NULL and it keeps the
    company name. Rows are removed in bulk, without per-row signals, children first.
    """
    from Inputs.Company import Company
    from Inputs.Decision import Decision
    from Inputs.MergeSuggestion import MergeSuggestion
    from Inputs.OutboxMessage import OutboxMessage
    from Inputs.Touchpoint import Touchpoint

    Decision.objects.exclude(company=None).update(company=None)
    OutboxMessage.objects.exclude(company=None).update(company=None)
    for model in (MergeSuggestion, Touchpoint, Company):
        queryset = model.objects.all()
        queryset._raw_delete(queryset.db)


def run_pipeline(inbound_file, signals_file) -> dict:
    """Rebuild the CRM from the uploaded files and return the stage counts."""
    from Inputs.Company import Company
    from Inputs.MergeSuggestion import MergeSuggestion
    from Inputs.Touchpoint import Touchpoint

    config = load_triage_config()
    records = read_csv(inbound_file)
    signals = signals_by_domain(read_csv(signals_file))

    groups = group_records(records)
    suggestions = find_suggested_merges(groups, config["suggested_merge_similarity"])

    clear_crm()

    group_rows = [[records[index] for index in group.record_indices] for group in groups]
    companies = []
    for group, rows in zip(groups, group_rows, strict=True):
        last_arrival = max(record["received_at"] for record in rows)
        known_signals = [
            signal
            for domain in group.domains
            for signal in signals.get(domain, [])
            if signal["event_date"] <= last_arrival
        ]
        companies.append(Company(**build_company_fields(rows, known_signals, config)))
    # Bulk loads skip per-row history (docs/lex_topics/03-lexmodel-core.md); edits people
    # make afterwards are tracked, and the Decision table is the audit log.
    companies = Company.objects.bulk_create(companies, skip_history=True)
    Touchpoint.objects.bulk_create(
        [
            Touchpoint(company=company, **touchpoint_fields(record))
            for company, rows in zip(companies, group_rows, strict=True)
            for record in rows
        ],
        skip_history=True,
    )

    MergeSuggestion.objects.bulk_create(
        [
            MergeSuggestion(
                company=companies[suggestion.first_group],
                candidate=companies[suggestion.second_group],
                similarity=suggestion.similarity,
            )
            for suggestion in suggestions
        ],
        skip_history=True,
    )

    counts = {
        "raw_records": len(records),
        "companies": len(companies),
        "suggested_merges": len(suggestions),
        "passed_filters": sum(1 for company in companies if company.passed_hard_filters),
    }
    LexLogger().add_heading("Deal-flow pipeline run", level=2).add_table(
        ["Stage", "Count"], [[stage, str(count)] for stage, count in counts.items()]
    ).log()
    return counts
