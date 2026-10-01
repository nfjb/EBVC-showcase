/** Typed reads and writes over the in-memory CRM tables. */

import type {
  Company,
  CompanyWithTouchpoints,
  DealFlowUpload,
  Decision,
  MergeSuggestion,
  OutboxMessage,
  Touchpoint,
} from "@/lib/triage/types";
import type { CompanyFields, TouchpointFields } from "@/lib/triage/pipeline";
import { compareCodePoints } from "@/lib/triage/py";

import {
  clearTable,
  deleteRow,
  getStore,
  insertRow,
  noteChange,
  type Row,
  type TableName,
  TABLE_COLUMNS,
  updateRow,
} from "./connection";

function byId(a: Row, b: Row): number {
  return Number(a.id) - Number(b.id);
}

/** Copies of the stored rows, so a caller never edits the store behind its back. */
function copies<T>(rows: Row[]): T[] {
  return rows.map((row) => ({ ...row }) as unknown as T);
}

function toCompany(row: Row): Company {
  return {
    ...(row as unknown as Company),
    passed_hard_filters: Boolean(row.passed_hard_filters),
  };
}

function companyParams(fields: Partial<CompanyFields>): Row {
  const params: Row = { ...fields };
  if ("passed_hard_filters" in fields) params.passed_hard_filters = fields.passed_hard_filters ? 1 : 0;
  return params;
}

function insert(table: TableName, values: Row): number {
  return insertRow(table, values);
}

function update(table: TableName, id: number, values: Row): void {
  if (!Object.keys(values).length) return;
  updateRow(table, id, values);
}

// ── companies ─────────────────────────────────────────────────────────────────────

export function insertCompany(fields: CompanyFields): number {
  return insert("company", companyParams(fields));
}

export function updateCompany(id: number, fields: Partial<CompanyFields>): void {
  update("company", id, companyParams(fields));
}

export function getCompany(id: number): Company | null {
  const row = getStore().company.find((candidate) => candidate.id === id);
  return row ? toCompany(row) : null;
}

export function listCompanies(): Company[] {
  return [...getStore().company].sort(byId).map(toCompany);
}

export function countCompanies(): number {
  return getStore().company.length;
}

/** Every company with its touchpoints (``Company.objects.prefetch_related("touchpoints")``). */
export function listCompaniesWithTouchpoints(): CompanyWithTouchpoints[] {
  const byCompany = new Map<number, Touchpoint[]>();
  for (const touchpoint of listTouchpoints()) {
    const list = byCompany.get(touchpoint.company_id);
    if (list) list.push(touchpoint);
    else byCompany.set(touchpoint.company_id, [touchpoint]);
  }
  return listCompanies().map((company) => ({ ...company, touchpoints: byCompany.get(company.id) ?? [] }));
}

export function getCompanyWithTouchpoints(id: number): CompanyWithTouchpoints | null {
  const company = getCompany(id);
  return company ? { ...company, touchpoints: touchpointsOf(id) } : null;
}

export function deleteCompany(id: number): void {
  const store = getStore();
  for (const row of store.decision) {
    if (row.company_id === id) row.company_id = null;
  }
  for (const row of store.outbox_message) {
    if (row.company_id === id) row.company_id = null;
  }
  noteChange();
  for (const row of [...store.merge_suggestion]) {
    if (row.company_id === id || row.candidate_id === id) deleteRow("merge_suggestion", Number(row.id));
  }
  for (const row of [...store.touchpoint]) {
    if (row.company_id === id) deleteRow("touchpoint", Number(row.id));
  }
  deleteRow("company", id);
}

// ── touchpoints ───────────────────────────────────────────────────────────────────

export function insertTouchpoint(companyId: number, fields: TouchpointFields): number {
  return insert("touchpoint", { ...fields, company_id: companyId });
}

export function listTouchpoints(): Touchpoint[] {
  return copies<Touchpoint>([...getStore().touchpoint].sort(byId));
}

export function countTouchpoints(): number {
  return getStore().touchpoint.length;
}

/** A company's touchpoints, oldest first. */
export function touchpointsOf(companyId: number): Touchpoint[] {
  return copies<Touchpoint>(
    getStore()
      .touchpoint.filter((row) => row.company_id === companyId)
      .sort((a, b) => {
        const byDate = compareCodePoints(String(a.received_at), String(b.received_at));
        return byDate !== 0 ? byDate : Number(a.id) - Number(b.id);
      }),
  );
}

export function getTouchpoint(id: number): Touchpoint | null {
  const row = getStore().touchpoint.find((candidate) => candidate.id === id);
  return row ? copies<Touchpoint>([row])[0] : null;
}

export function warmIntros(): Touchpoint[] {
  return copies<Touchpoint>(getStore().touchpoint.filter((row) => row.channel === "warm_intro").sort(byId));
}

export function updateTouchpoint(id: number, fields: Partial<TouchpointFields>): void {
  update("touchpoint", id, fields as Row);
}

export function moveTouchpoints(fromCompanyId: number, toCompanyId: number): void {
  for (const row of getStore().touchpoint) {
    if (row.company_id === fromCompanyId) row.company_id = toCompanyId;
  }
  noteChange();
}

// ── merge suggestions ─────────────────────────────────────────────────────────────

export function insertMergeSuggestion(companyId: number, candidateId: number, similarity: number): number {
  return insert("merge_suggestion", {
    company_id: companyId,
    candidate_id: candidateId,
    similarity,
    status: "pending",
    decided_by: "",
  });
}

export function getMergeSuggestion(id: number): MergeSuggestion | null {
  const row = getStore().merge_suggestion.find((candidate) => candidate.id === id);
  return row ? copies<MergeSuggestion>([row])[0] : null;
}

export function listMergeSuggestions(status?: string): MergeSuggestion[] {
  const rows = status
    ? getStore().merge_suggestion.filter((row) => row.status === status)
    : getStore().merge_suggestion;
  return copies<MergeSuggestion>([...rows].sort(byId));
}

export function countPendingMergeSuggestions(): number {
  return getStore().merge_suggestion.filter((row) => row.status === "pending").length;
}

export function updateMergeSuggestion(id: number, fields: Partial<MergeSuggestion>): void {
  update("merge_suggestion", id, fields as Row);
}

// ── decisions (audit log) ─────────────────────────────────────────────────────────

export function insertDecision(fields: Omit<Decision, "id">): number {
  return insert("decision", fields as unknown as Row);
}

/** Newest first. */
export function listDecisions(): Decision[] {
  return copies<Decision>(
    [...getStore().decision].sort((a, b) => {
      const byTime = compareCodePoints(String(b.decided_at), String(a.decided_at));
      return byTime !== 0 ? byTime : Number(b.id) - Number(a.id);
    }),
  );
}

// ── outbox ────────────────────────────────────────────────────────────────────────

export function insertOutboxMessage(fields: Omit<OutboxMessage, "id">): number {
  return insert("outbox_message", fields as unknown as Row);
}

/** Newest first. */
export function listOutboxMessages(): OutboxMessage[] {
  return copies<OutboxMessage>(
    [...getStore().outbox_message].sort((a, b) => {
      const byTime = compareCodePoints(String(b.sent_at), String(a.sent_at));
      return byTime !== 0 ? byTime : Number(b.id) - Number(a.id);
    }),
  );
}

export function countOutboxMessagesOf(companyId: number): number {
  return getStore().outbox_message.filter((row) => row.company_id === companyId).length;
}

/** Companies that already had a pass reply sent (``OutboxMessage.objects.filter(kind="pass")``). */
export function companyIdsWithPassReply(): Set<number> {
  return new Set(
    getStore()
      .outbox_message.filter((row) => row.kind === "pass" && row.company_id != null)
      .map((row) => Number(row.company_id)),
  );
}

// ── uploads ───────────────────────────────────────────────────────────────────────

export function insertUpload(fields: Omit<DealFlowUpload, "id">): number {
  return insert("deal_flow_upload", fields as unknown as Row);
}

export function listUploads(): DealFlowUpload[] {
  return copies<DealFlowUpload>([...getStore().deal_flow_upload].sort((a, b) => byId(b, a)));
}

export function listTablePage(
  table: TableName,
  limit: number,
  offset: number,
): { total: number; rows: Row[]; columns: string[] } {
  const rows = [...getStore()[table]].sort(byId);
  return { total: rows.length, rows: copies<Row>(rows.slice(offset, offset + limit)), columns: TABLE_COLUMNS[table] };
}

// ── the whole CRM ─────────────────────────────────────────────────────────────────

/**
 * The upload is the CRM's source of truth, so a run rebuilds it from scratch.
 *
 * The Decision audit log and the Outbox are kept: their company link is set to NULL and they
 * keep the company name. Children go first.
 */
export function clearCrm(): void {
  const store = getStore();
  for (const row of store.decision) {
    if (row.company_id != null) row.company_id = null;
  }
  for (const row of store.outbox_message) {
    if (row.company_id != null) row.company_id = null;
  }
  noteChange();
  clearTable("merge_suggestion");
  clearTable("touchpoint");
  clearTable("company");
}
