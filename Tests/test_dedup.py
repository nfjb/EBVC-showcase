"""The three match rules of the dedup step (spec §2, §10)."""

import pytest

from Uploads._dedup import domains_conflict, find_suggested_merges, group_records

pytestmark = pytest.mark.unit

THRESHOLD = 0.92


def record(company_name, website="", founder_email="", founder_linkedin=""):
    return {
        "company_name": company_name,
        "website": website,
        "founder_email": founder_email,
        "founder_linkedin": founder_linkedin,
    }


def test_rule_1_same_normalised_domain_merges():
    records = [
        record("Robotix AI", website="https://robotix.ai"),
        record("Totally Different Name", website="www.robotix.ai/"),
    ]
    groups = group_records(records)
    assert len(groups) == 1
    assert groups[0].record_indices == [0, 1]


def test_rule_2_same_founder_email_merges():
    records = [
        record("Robotix", founder_email="Anna@robotix.ai"),
        record("RobotiX GmbH", founder_email="anna@robotix.ai "),
    ]
    assert len(group_records(records)) == 1


def test_rule_2_same_linkedin_merges():
    records = [
        record("Robotix", founder_linkedin="https://www.linkedin.com/in/anna-berg/"),
        record("Robo", founder_linkedin="linkedin.com/in/Anna-Berg"),
    ]
    assert len(group_records(records)) == 1


def test_rules_chain_across_records():
    """A shares a domain with B, B shares an email with C → one company."""
    records = [
        record("Robotix", website="robotix.ai"),
        record("Robotix", website="robotix.ai", founder_email="anna@robotix.ai"),
        record("RobotiX GmbH", founder_email="anna@robotix.ai"),
    ]
    assert len(group_records(records)) == 1


def test_rule_3_similar_name_is_only_suggested_never_merged():
    records = [record("Robotix AI"), record("Robotics")]
    groups = group_records(records)
    assert len(groups) == 2
    suggestions = find_suggested_merges(groups, THRESHOLD)
    assert len(suggestions) == 1
    assert suggestions[0].similarity >= THRESHOLD


def test_rule_3_conflicting_domain_blocks_the_suggestion():
    records = [
        record("Robotix AI", website="robotix.ai"),
        record("Robotix", website="robotix-industrial.de"),
    ]
    groups = group_records(records)
    assert len(groups) == 2
    assert find_suggested_merges(groups, THRESHOLD) == []


def test_rule_3_dissimilar_names_are_not_suggested():
    records = [record("Robotix"), record("Nordic Grid")]
    assert find_suggested_merges(group_records(records), THRESHOLD) == []


def test_domains_conflict_needs_a_domain_on_both_sides():
    assert domains_conflict({"a.io"}, {"b.io"})
    assert not domains_conflict({"a.io"}, set())
    assert not domains_conflict({"a.io", "b.io"}, {"b.io"})
