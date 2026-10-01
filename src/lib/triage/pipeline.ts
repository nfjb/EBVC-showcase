/**
 * The triage pipeline's pure part (spec §2–§4): everything ``run_pipeline`` computes before
 * it writes to the CRM.
 *
 * capture (the two CSVs) → merge → companies + touchpoints → hard filters → enrichment
 * (signals known at intake) → scoring. Signals dated after a company's last arrival are left
 * for the weekly freshness re-check, which is not part of the MVP.
 */

import type { ThesisKeywords, TriageConfig } from "./config";
import { readCsv, type CsvRow } from "./csv";
import { monthYear, parseIsoDate, type IsoDate } from "./dates";
import { findSuggestedMerges, groupRecords, type SuggestedMerge } from "./dedup";
import { hardFilterPassCode } from "./filters";
import { normaliseDomain } from "./normalise";
import { pyToInt } from "./py";
import { momentumFromSignals, scoreCompany, sourceQualityFromChannels, suggestThesisFit } from "./scoring";
import type { Company, Touchpoint } from "./types";

export const INBOUND_REQUIRED_COLUMNS = ["record_id", "channel", "received_at", "company_name"];
export const SIGNALS_REQUIRED_COLUMNS = ["signal_type", "event_date", "description"];

export type CompanyFields = Omit<Company, "id">;
export type TouchpointFields = Omit<Touchpoint, "id" | "company_id">;

export interface PipelinePlan {
  records: CsvRow[];
  companies: { fields: CompanyFields; touchpoints: TouchpointFields[] }[];
  suggestions: SuggestedMerge[];
}

/** The most recent non-empty value of ``field`` across a company's records. */
export function latestValue(records: CsvRow[], field: string): string {
  // Newest first; records with the same date keep their file order (Python's stable sort).
  const newestFirst = [...records].sort((a, b) =>
    a.received_at === b.received_at ? 0 : a.received_at < b.received_at ? 1 : -1,
  );
  for (const record of newestFirst) if (record[field]) return record[field];
  return "";
}

export function signalsByDomain(signalRows: CsvRow[]): Map<string, CsvRow[]> {
  const grouped = new Map<string, CsvRow[]>();
  for (const signal of signalRows) {
    const domain = normaliseDomain(signal.website);
    const list = grouped.get(domain);
    if (list) list.push(signal);
    else grouped.set(domain, [signal]);
  }
  return grouped;
}

export function describeSignal(signal: CsvRow): string {
  return `${signal.description} (${monthYear(parseIsoDate(signal.event_date))})`;
}

function earliest(records: CsvRow[]): CsvRow {
  return records.reduce((first, record) => (record.received_at < first.received_at ? record : first));
}

/** Company-level fields for one group of records (the same company). */
export function buildCompanyFields(
  records: CsvRow[],
  knownSignals: CsvRow[],
  config: TriageConfig,
  keywords: ThesisKeywords,
): CompanyFields {
  const first = earliest(records);
  const stage = latestValue(records, "stage");
  const country = latestValue(records, "country");
  const roundSizeEur = pyToInt(latestValue(records, "round_size_eur"));
  const deckText = latestValue(records, "deck_text");
  const passCode = hardFilterPassCode(stage, country, roundSizeEur, config.hard_filters);
  const components = {
    thesis_fit: suggestThesisFit(deckText, keywords),
    market: null,
    team: null,
    momentum: momentumFromSignals(
      knownSignals.map((signal) => signal.signal_type),
      config.momentum_cap,
    ),
    source_quality: sourceQualityFromChannels(
      records.map((record) => record.channel),
      config.source_quality,
    ),
  };
  const [score, breakdown] = scoreCompany(components, config.weights);
  const latestSignal = knownSignals.reduce<CsvRow | null>(
    (latest, signal) => (latest === null || signal.event_date > latest.event_date ? signal : latest),
    null,
  );
  const withWebsite = records.find((record) => record.website);
  return {
    name: first.company_name,
    website_domain: withWebsite ? normaliseDomain(withWebsite.website) : "",
    country,
    stage,
    round_size_eur: roundSizeEur,
    one_liner: latestValue(records, "one_liner"),
    deck_text: deckText,
    first_seen_at: parseIsoDate(first.received_at),
    touchpoint_count: records.length,
    owner: first.recipient ?? "",
    status: "open",
    passed_hard_filters: passCode === "",
    pass_code: passCode,
    thesis_fit: components.thesis_fit,
    thesis_fit_confirmed: false,
    market: null,
    team: null,
    momentum: components.momentum,
    source_quality: components.source_quality,
    score,
    score_breakdown: JSON.stringify(breakdown),
    latest_signal: latestSignal ? describeSignal(latestSignal) : "",
    latest_signal_at: latestSignal ? parseIsoDate(latestSignal.event_date) : null,
    rank_override: null,
    rank_override_comment: "",
  };
}

export function touchpointFields(record: CsvRow): TouchpointFields {
  const isIntro = record.channel === "warm_intro";
  return {
    record_id: record.record_id,
    channel: record.channel,
    received_at: parseIsoDate(record.received_at),
    recipient: record.recipient ?? "",
    company_name: record.company_name,
    website: record.website ?? "",
    founder_name: record.founder_name ?? "",
    founder_email: record.founder_email ?? "",
    founder_linkedin: record.founder_linkedin ?? "",
    country: record.country ?? "",
    stage: record.stage ?? "",
    round_size_eur: pyToInt(record.round_size_eur ?? ""),
    one_liner: record.one_liner ?? "",
    deck_text: record.deck_text ?? "",
    introducer_name: record.introducer_name ?? "",
    introducer_type: record.introducer_type || "none",
    intro_status: isIntro ? "open" : "",
    intro_replied_at: null,
  };
}

/** Read both files and work out every company, touchpoint and suggested merge. Writes nothing. */
export function planPipeline(
  inboundText: string,
  signalsText: string,
  config: TriageConfig,
  keywords: ThesisKeywords,
): PipelinePlan {
  const records = readCsv(inboundText, INBOUND_REQUIRED_COLUMNS, "Inbound CSV");
  const signals = signalsByDomain(readCsv(signalsText, SIGNALS_REQUIRED_COLUMNS, "Signals CSV"));

  const groups = groupRecords(records);
  const suggestions = findSuggestedMerges(groups, config.suggested_merge_similarity);

  const companies = groups.map((group) => {
    const rows = group.record_indices.map((index) => records[index]);
    const lastArrival: IsoDate = rows.reduce(
      (latest, record) => (record.received_at > latest ? record.received_at : latest),
      rows[0].received_at,
    );
    const knownSignals = [...group.domains].flatMap((domain) =>
      (signals.get(domain) ?? []).filter((signal) => signal.event_date <= lastArrival),
    );
    return {
      fields: buildCompanyFields(rows, knownSignals, config, keywords),
      touchpoints: rows.map(touchpointFields),
    };
  });
  return { records, companies, suggestions };
}
