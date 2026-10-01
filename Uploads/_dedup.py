"""Group raw inbound records into companies (spec §2).

Rules, in order:
1. exact match on normalised domain → same company;
2. exact match on founder email or normalised LinkedIn URL → same company;
3. fuzzy match on normalised company name (Jaro-Winkler ≥ threshold) with no conflicting
   domain → a *suggested* merge only. Rule 3 never merges anything by itself.
"""

from dataclasses import dataclass, field
from itertools import combinations

from rapidfuzz.distance import JaroWinkler

from Uploads._normalise import (
    normalise_company_name,
    normalise_domain,
    normalise_email,
    normalise_linkedin,
)


@dataclass
class RecordGroup:
    """Indices of raw records that are the same company."""

    record_indices: list[int]
    domains: set[str] = field(default_factory=set)
    names: set[str] = field(default_factory=set)


@dataclass
class SuggestedMerge:
    first_group: int
    second_group: int
    similarity: float


class _UnionFind:
    def __init__(self, size: int):
        self.parent = list(range(size))

    def find(self, index: int) -> int:
        while self.parent[index] != index:
            self.parent[index] = self.parent[self.parent[index]]
            index = self.parent[index]
        return index

    def union(self, first: int, second: int) -> None:
        self.parent[self.find(second)] = self.find(first)


def _union_on_key(records: list[dict], union_find: _UnionFind, key_function) -> None:
    first_index_by_key: dict[str, int] = {}
    for index, record in enumerate(records):
        for key in key_function(record):
            if not key:
                continue
            if key in first_index_by_key:
                union_find.union(first_index_by_key[key], index)
            else:
                first_index_by_key[key] = index


def group_records(records: list[dict]) -> list[RecordGroup]:
    """Apply rules 1 and 2 and return one group per company, in first-seen order."""
    union_find = _UnionFind(len(records))
    _union_on_key(records, union_find, lambda record: [normalise_domain(record.get("website"))])
    _union_on_key(
        records,
        union_find,
        lambda record: [
            normalise_email(record.get("founder_email")),
            normalise_linkedin(record.get("founder_linkedin")),
        ],
    )
    groups_by_root: dict[int, RecordGroup] = {}
    for index, record in enumerate(records):
        group = groups_by_root.setdefault(union_find.find(index), RecordGroup(record_indices=[]))
        group.record_indices.append(index)
        domain = normalise_domain(record.get("website"))
        if domain:
            group.domains.add(domain)
        name = normalise_company_name(record.get("company_name"))
        if name:
            group.names.add(name)
    return list(groups_by_root.values())


def name_similarity(first_names: set[str], second_names: set[str]) -> float:
    return max(
        (JaroWinkler.similarity(first, second) for first in first_names for second in second_names),
        default=0.0,
    )


def domains_conflict(first_domains: set[str], second_domains: set[str]) -> bool:
    """Both groups have a domain and none is shared → different companies."""
    return bool(first_domains) and bool(second_domains) and not (first_domains & second_domains)


def find_suggested_merges(groups: list[RecordGroup], threshold: float) -> list[SuggestedMerge]:
    """Rule 3: fuzzy company-name matches between groups, for a person to confirm."""
    suggestions = []
    for first_index, second_index in combinations(range(len(groups)), 2):
        first, second = groups[first_index], groups[second_index]
        if domains_conflict(first.domains, second.domains):
            continue
        similarity = name_similarity(first.names, second.names)
        if similarity >= threshold:
            suggestions.append(SuggestedMerge(first_index, second_index, round(similarity, 4)))
    return suggestions
