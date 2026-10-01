/** Typed reads and writes over the CRM tables. Server-only. */

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

import { getDb } from "./connection";

type Row = Record<string, unknown>;

function toCompany(row: Row): Company {
  return {
    ...(row as unknown as Company),
    passed_hard_filters: Boolean(row.passed_hard_filters),
    thesis_fit_confirmed: Boolean(row.thesis_fit_confirmed),
  };
}

function companyParams(fields: Partial<CompanyFields>): Row {
  const params: Row = { ...fields };
  if ("passed_hard_filters" in fields) params.passed_hard_filters = fields.passed_hard_filters ? 1 : 0;
  if ("thesis_fit_confirmed" in fields) params.thesis_fit_confirmed = fields.thesis_fit_confirmed ? 1 : 0;
  return params;
}

function insert(table: string, values: Row): number {
  const columns = Object.keys(values);
  const statement = getDb().prepare(
    `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map((column) => `@${column}`).join(", ")})`,
  );
  return Number(statement.run(values).lastInsertRowid);
}

function update(table: string, id: number, values: Row): void {
  const columns = Object.keys(values);
  if (!columns.length) return;
  getDb()
    .prepare(`UPDATE ${table} SET ${columns.map((column) => `${column} = @${column}`).join(", ")} WHERE id = @id`)
    .run({ ...values, id });
}

// ── companies ─────────────────────────────────────────────────────────────────────

export function insertCompany(fields: CompanyFields): number {
  return insert("company", companyParams(fields));
}

export function updateCompany(id: number, fields: Partial<CompanyFields>): void {
  update("company", id, companyParams(fields));
}

export function getCompany(id: number): Company | null {
  const row = getDb().prepare("SELECT * FROM company WHERE id = ?").get(id) as Row | undefined;
  return row ? toCompany(row) : null;
}

export function listCompanies(): Company[] {
  return (getDb().prepare("SELECT * FROM company ORDER BY id").all() as Row[]).map(toCompany);
}

export function countCompanies(): number {
  return (getDb().prepare("SELECT COUNT(*) AS n FROM company").get() as { n: number }).n;
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
  getDb().prepare("DELETE FROM company WHERE id = ?").run(id);
}

// ── touchpoints ───────────────────────────────────────────────────────────────────

export function insertTouchpoint(companyId: number, fields: TouchpointFields): number {
  return insert("touchpoint", { ...fields, company_id: companyId });
}

export function listTouchpoints(): Touchpoint[] {
  return getDb().prepare("SELECT * FROM touchpoint ORDER BY id").all() as Touchpoint[];
}

export function countTouchpoints(): number {
  return (getDb().prepare("SELECT COUNT(*) AS n FROM touchpoint").get() as { n: number }).n;
}

/** A company's touchpoints, oldest first. */
export function touchpointsOf(companyId: number): Touchpoint[] {
  return getDb()
    .prepare("SELECT * FROM touchpoint WHERE company_id = ? ORDER BY received_at, id")
    .all(companyId) as Touchpoint[];
}

export function getTouchpoint(id: number): Touchpoint | null {
  return (getDb().prepare("SELECT * FROM touchpoint WHERE id = ?").get(id) as Touchpoint | undefined) ?? null;
}

export function warmIntros(): Touchpoint[] {
  return getDb().prepare("SELECT * FROM touchpoint WHERE channel = 'warm_intro' ORDER BY id").all() as Touchpoint[];
}

export function updateTouchpoint(id: number, fields: Partial<TouchpointFields>): void {
  update("touchpoint", id, fields as Row);
}

export function moveTouchpoints(fromCompanyId: number, toCompanyId: number): void {
  getDb().prepare("UPDATE touchpoint SET company_id = ? WHERE company_id = ?").run(toCompanyId, fromCompanyId);
}

// ── merge suggestions ─────────────────────────────────────────────────────────────

export function insertMergeSuggestion(companyId: number, candidateId: number, similarity: number): number {
  return insert("merge_suggestion", { company_id: companyId, candidate_id: candidateId, similarity, status: "pending" });
}

export function getMergeSuggestion(id: number): MergeSuggestion | null {
  return (
    (getDb().prepare("SELECT * FROM merge_suggestion WHERE id = ?").get(id) as MergeSuggestion | undefined) ?? null
  );
}

export function listMergeSuggestions(status?: string): MergeSuggestion[] {
  const db = getDb();
  return (
    status
      ? db.prepare("SELECT * FROM merge_suggestion WHERE status = ? ORDER BY id").all(status)
      : db.prepare("SELECT * FROM merge_suggestion ORDER BY id").all()
  ) as MergeSuggestion[];
}

export function countPendingMergeSuggestions(): number {
  return (
    getDb().prepare("SELECT COUNT(*) AS n FROM merge_suggestion WHERE status = 'pending'").get() as { n: number }
  ).n;
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
  return getDb().prepare("SELECT * FROM decision ORDER BY decided_at DESC, id DESC").all() as Decision[];
}

// ── outbox ────────────────────────────────────────────────────────────────────────

export function insertOutboxMessage(fields: Omit<OutboxMessage, "id">): number {
  return insert("outbox_message", fields as unknown as Row);
}

/** Newest first. */
export function listOutboxMessages(): OutboxMessage[] {
  return getDb().prepare("SELECT * FROM outbox_message ORDER BY sent_at DESC, id DESC").all() as OutboxMessage[];
}

export function countOutboxMessagesOf(companyId: number): number {
  return (
    getDb().prepare("SELECT COUNT(*) AS n FROM outbox_message WHERE company_id = ?").get(companyId) as { n: number }
  ).n;
}

/** Companies that already had a pass reply sent (``OutboxMessage.objects.filter(kind="pass")``). */
export function companyIdsWithPassReply(): Set<number> {
  const rows = getDb()
    .prepare("SELECT DISTINCT company_id FROM outbox_message WHERE kind = 'pass' AND company_id IS NOT NULL")
    .all() as { company_id: number }[];
  return new Set(rows.map((row) => row.company_id));
}

// ── uploads ───────────────────────────────────────────────────────────────────────

export function insertUpload(fields: Omit<DealFlowUpload, "id">): number {
  return insert("deal_flow_upload", fields as unknown as Row);
}

export function listUploads(): DealFlowUpload[] {
  return getDb().prepare("SELECT * FROM deal_flow_upload ORDER BY id DESC").all() as DealFlowUpload[];
}

// ── the whole CRM ─────────────────────────────────────────────────────────────────

/**
 * The upload is the CRM's source of truth, so a run rebuilds it from scratch.
 *
 * The Decision audit log and the Outbox are kept: their company link is set to NULL and they
 * keep the company name. Children go first.
 */
export function clearCrm(): void {
  const db = getDb();
  db.prepare("UPDATE decision SET company_id = NULL WHERE company_id IS NOT NULL").run();
  db.prepare("UPDATE outbox_message SET company_id = NULL WHERE company_id IS NOT NULL").run();
  db.prepare("DELETE FROM merge_suggestion").run();
  db.prepare("DELETE FROM touchpoint").run();
  db.prepare("DELETE FROM company").run();
}
