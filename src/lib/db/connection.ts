/**
 * In-memory CRM store. Nothing is written to disk: the demo lives in this browser tab, so
 * it can run on hosts with no persistent filesystem (including Vercel). A reload empties it.
 *
 * Ids are never reused (like AUTOINCREMENT). Deletes follow the same rules as the Django
 * models: touchpoints and merge suggestions go with the company; the audit log and
 * Outbox keep the company name and lose the link.
 */

export type Row = Record<string, unknown>;

export type TableName =
  | "company"
  | "touchpoint"
  | "merge_suggestion"
  | "decision"
  | "outbox_message"
  | "deal_flow_upload";

export const TABLE_COLUMNS: Record<TableName, string[]> = {
  company: [
    "id",
    "name",
    "website_domain",
    "country",
    "stage",
    "round_size_eur",
    "one_liner",
    "deck_text",
    "first_seen_at",
    "touchpoint_count",
    "owner",
    "status",
    "passed_hard_filters",
    "pass_code",
    "team",
    "market",
    "problem_solution_fit",
    "technology_product",
    "business_model",
    "traction_validation",
    "competition",
    "go_to_market",
    "financials",
    "exit_potential",
    "storytelling_bonus",
    "rating_source",
    "rating_rationale",
    "rating_model",
    "rated_by",
    "rated_at",
    "score",
    "score_breakdown",
    "latest_signal",
    "latest_signal_at",
    "latest_signal_type",
    "rank_override",
    "rank_override_comment",
  ],
  touchpoint: [
    "id",
    "company_id",
    "record_id",
    "channel",
    "received_at",
    "recipient",
    "company_name",
    "website",
    "founder_name",
    "founder_email",
    "founder_linkedin",
    "country",
    "stage",
    "round_size_eur",
    "one_liner",
    "deck_text",
    "introducer_name",
    "introducer_type",
    "intro_status",
    "intro_replied_at",
  ],
  merge_suggestion: ["id", "company_id", "candidate_id", "similarity", "status", "decided_by", "decided_at"],
  decision: ["id", "company_id", "company_name", "decision", "pass_code", "comment", "decided_by", "decided_at"],
  outbox_message: [
    "id",
    "company_id",
    "company_name",
    "kind",
    "recipient_name",
    "recipient_address",
    "subject",
    "body",
    "sent_by",
    "sent_at",
  ],
  deal_flow_upload: [
    "id",
    "inbound_file",
    "signals_file",
    "raw_record_count",
    "company_count",
    "suggested_merge_count",
    "passed_filter_count",
    "status",
    "error",
    "uploaded_by",
    "created_at",
  ],
};

export interface CrmStore {
  company: Row[];
  touchpoint: Row[];
  merge_suggestion: Row[];
  decision: Row[];
  outbox_message: Row[];
  deal_flow_upload: Row[];
  seq: Record<TableName, number>;
}

type Listener = () => void;

const holder = globalThis as typeof globalThis & { __skarvStore?: CrmStore; __skarvVersion?: number };

const listeners = new Set<Listener>();
let txDepth = 0;
let dirty = false;

export function emptyStore(): CrmStore {
  return {
    company: [],
    touchpoint: [],
    merge_suggestion: [],
    decision: [],
    outbox_message: [],
    deal_flow_upload: [],
    seq: {
      company: 0,
      touchpoint: 0,
      merge_suggestion: 0,
      decision: 0,
      outbox_message: 0,
      deal_flow_upload: 0,
    },
  };
}

export function getStore(): CrmStore {
  if (!holder.__skarvStore) holder.__skarvStore = emptyStore();
  return holder.__skarvStore;
}

/** Tests: swap in a fresh empty CRM. */
export function openDatabase(_file?: string): CrmStore {
  return emptyStore();
}

export function useDatabase(next: CrmStore): void {
  holder.__skarvStore = next;
  holder.__skarvVersion = (holder.__skarvVersion ?? 0) + 1;
  for (const listener of listeners) listener();
}

export function getVersion(): number {
  return holder.__skarvVersion ?? 0;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  holder.__skarvVersion = (holder.__skarvVersion ?? 0) + 1;
  for (const listener of listeners) listener();
}

function markDirty(): void {
  dirty = true;
  if (txDepth === 0) {
    dirty = false;
    notify();
  }
}

export function insertRow(table: TableName, values: Row): number {
  const store = getStore();
  store.seq[table] += 1;
  const id = store.seq[table];
  // Columns left out are NULL, as an INSERT that names only some columns would leave them.
  const row: Row = Object.fromEntries(TABLE_COLUMNS[table].map((column) => [column, null]));
  store[table].push(Object.assign(row, values, { id }));
  markDirty();
  return id;
}

export function updateRow(table: TableName, id: number, values: Row): void {
  const row = getStore()[table].find((candidate) => candidate.id === id);
  if (!row) return;
  Object.assign(row, values);
  markDirty();
}

export function deleteRow(table: TableName, id: number): void {
  const rows = getStore()[table];
  const index = rows.findIndex((row) => row.id === id);
  if (index < 0) return;
  rows.splice(index, 1);
  markDirty();
}

export function clearTable(table: TableName): void {
  getStore()[table].length = 0;
  markDirty();
}

/** In-place edits that did not go through insert/update/delete still need a notify. */
export function noteChange(): void {
  markDirty();
}

/** Run ``work`` as one unit: if it throws, the store is left as it was. */
export function atomic<T>(work: () => T): T {
  const snapshot = structuredClone(getStore());
  txDepth += 1;
  try {
    const result = work();
    txDepth -= 1;
    if (txDepth === 0 && dirty) {
      dirty = false;
      notify();
    }
    return result;
  } catch (error) {
    holder.__skarvStore = snapshot;
    txDepth -= 1;
    dirty = false;
    throw error;
  }
}
