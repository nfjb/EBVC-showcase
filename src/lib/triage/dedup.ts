/**
 * Group raw inbound records into companies (spec §2).
 *
 * Rules, in order:
 * 1. exact match on normalised domain → same company;
 * 2. exact match on founder email or normalised LinkedIn URL → same company;
 * 3. fuzzy match on normalised company name (Jaro-Winkler ≥ threshold) with no conflicting
 *    domain → a *suggested* merge only. Rule 3 never merges anything by itself.
 */

import { jaroWinklerSimilarity } from "./jaroWinkler";
import { normaliseCompanyName, normaliseDomain, normaliseEmail, normaliseLinkedin } from "./normalise";
import { pyRound } from "./py";

export interface MatchableRecord {
  company_name?: string;
  website?: string;
  founder_email?: string;
  founder_linkedin?: string;
}

/** Indices of raw records that are the same company. */
export interface RecordGroup {
  record_indices: number[];
  domains: Set<string>;
  names: Set<string>;
}

export interface SuggestedMerge {
  first_group: number;
  second_group: number;
  similarity: number;
}

class UnionFind {
  private parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
  }

  find(index: number): number {
    while (this.parent[index] !== index) {
      this.parent[index] = this.parent[this.parent[index]];
      index = this.parent[index];
    }
    return index;
  }

  union(first: number, second: number): void {
    this.parent[this.find(second)] = this.find(first);
  }
}

function unionOnKey(
  records: MatchableRecord[],
  unionFind: UnionFind,
  keyFunction: (record: MatchableRecord) => string[],
): void {
  const firstIndexByKey = new Map<string, number>();
  records.forEach((record, index) => {
    for (const key of keyFunction(record)) {
      if (!key) continue;
      const firstIndex = firstIndexByKey.get(key);
      if (firstIndex !== undefined) unionFind.union(firstIndex, index);
      else firstIndexByKey.set(key, index);
    }
  });
}

/** Apply rules 1 and 2 and return one group per company, in first-seen order. */
export function groupRecords(records: MatchableRecord[]): RecordGroup[] {
  const unionFind = new UnionFind(records.length);
  unionOnKey(records, unionFind, (record) => [normaliseDomain(record.website)]);
  unionOnKey(records, unionFind, (record) => [
    normaliseEmail(record.founder_email),
    normaliseLinkedin(record.founder_linkedin),
  ]);
  const groupsByRoot = new Map<number, RecordGroup>();
  records.forEach((record, index) => {
    const root = unionFind.find(index);
    let group = groupsByRoot.get(root);
    if (!group) {
      group = { record_indices: [], domains: new Set(), names: new Set() };
      groupsByRoot.set(root, group);
    }
    group.record_indices.push(index);
    const domain = normaliseDomain(record.website);
    if (domain) group.domains.add(domain);
    const name = normaliseCompanyName(record.company_name);
    if (name) group.names.add(name);
  });
  return [...groupsByRoot.values()];
}

export function nameSimilarity(firstNames: Set<string>, secondNames: Set<string>): number {
  let best = 0;
  let any = false;
  for (const first of firstNames) {
    for (const second of secondNames) {
      const similarity = jaroWinklerSimilarity(first, second);
      best = any ? Math.max(best, similarity) : similarity;
      any = true;
    }
  }
  return any ? best : 0;
}

/** Both groups have a domain and none is shared → different companies. */
export function domainsConflict(firstDomains: Set<string>, secondDomains: Set<string>): boolean {
  if (!firstDomains.size || !secondDomains.size) return false;
  for (const domain of firstDomains) if (secondDomains.has(domain)) return false;
  return true;
}

/** Rule 3: fuzzy company-name matches between groups, for a person to confirm. */
export function findSuggestedMerges(groups: RecordGroup[], threshold: number): SuggestedMerge[] {
  const suggestions: SuggestedMerge[] = [];
  for (let firstIndex = 0; firstIndex < groups.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < groups.length; secondIndex += 1) {
      const first = groups[firstIndex];
      const second = groups[secondIndex];
      if (domainsConflict(first.domains, second.domains)) continue;
      const similarity = nameSimilarity(first.names, second.names);
      if (similarity >= threshold) {
        suggestions.push({ first_group: firstIndex, second_group: secondIndex, similarity: pyRound(similarity, 4) });
      }
    }
  }
  return suggestions;
}
