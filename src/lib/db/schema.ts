/**
 * The CRM store. One table per record type, with the same delete rules the Django models had:
 *
 * - touchpoints and merge suggestions belong to a company and go with it (CASCADE);
 * - the Decision audit log and the Outbox outlive it: a re-upload rebuilds the CRM and an
 *   approved merge deletes the merged-away company, so their link is set to NULL and they
 *   keep the company name.
 *
 * Dates are TEXT ``YYYY-MM-DD``, timestamps TEXT ISO-8601 (UTC), booleans INTEGER 0/1.
 * AUTOINCREMENT keeps ids from being reused after a re-upload, as Django's AutoField does.
 */

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS company (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  website_domain TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT '',
  round_size_eur INTEGER,
  one_liner TEXT NOT NULL DEFAULT '',
  deck_text TEXT NOT NULL DEFAULT '',
  first_seen_at TEXT,
  touchpoint_count INTEGER NOT NULL DEFAULT 0,
  owner TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  passed_hard_filters INTEGER NOT NULL DEFAULT 0,
  pass_code TEXT NOT NULL DEFAULT '',
  thesis_fit INTEGER,
  thesis_fit_confirmed INTEGER NOT NULL DEFAULT 0,
  market INTEGER,
  team INTEGER,
  momentum INTEGER NOT NULL DEFAULT 0,
  source_quality INTEGER NOT NULL DEFAULT 0,
  score REAL NOT NULL DEFAULT 0,
  score_breakdown TEXT NOT NULL DEFAULT '[]',
  latest_signal TEXT NOT NULL DEFAULT '',
  latest_signal_at TEXT,
  rank_override INTEGER,
  rank_override_comment TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS touchpoint (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  record_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  received_at TEXT NOT NULL,
  recipient TEXT NOT NULL DEFAULT '',
  company_name TEXT NOT NULL,
  website TEXT NOT NULL DEFAULT '',
  founder_name TEXT NOT NULL DEFAULT '',
  founder_email TEXT NOT NULL DEFAULT '',
  founder_linkedin TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT '',
  round_size_eur INTEGER,
  one_liner TEXT NOT NULL DEFAULT '',
  deck_text TEXT NOT NULL DEFAULT '',
  introducer_name TEXT NOT NULL DEFAULT '',
  introducer_type TEXT NOT NULL DEFAULT 'none',
  intro_status TEXT NOT NULL DEFAULT '',
  intro_replied_at TEXT
);
CREATE INDEX IF NOT EXISTS touchpoint_company ON touchpoint(company_id);

CREATE TABLE IF NOT EXISTS merge_suggestion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  candidate_id INTEGER NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  similarity REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  decided_by TEXT NOT NULL DEFAULT '',
  decided_at TEXT
);
CREATE INDEX IF NOT EXISTS merge_suggestion_company ON merge_suggestion(company_id);
CREATE INDEX IF NOT EXISTS merge_suggestion_candidate ON merge_suggestion(candidate_id);

CREATE TABLE IF NOT EXISTS decision (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER REFERENCES company(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,
  decision TEXT NOT NULL,
  pass_code TEXT NOT NULL DEFAULT '',
  comment TEXT NOT NULL DEFAULT '',
  decided_by TEXT NOT NULL,
  decided_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS decision_company ON decision(company_id);

CREATE TABLE IF NOT EXISTS outbox_message (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER REFERENCES company(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,
  kind TEXT NOT NULL,
  recipient_name TEXT NOT NULL DEFAULT '',
  recipient_address TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_by TEXT NOT NULL,
  sent_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS outbox_message_company ON outbox_message(company_id);

CREATE TABLE IF NOT EXISTS deal_flow_upload (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inbound_file TEXT NOT NULL,
  signals_file TEXT NOT NULL,
  raw_record_count INTEGER NOT NULL DEFAULT 0,
  company_count INTEGER NOT NULL DEFAULT 0,
  suggested_merge_count INTEGER NOT NULL DEFAULT 0,
  passed_filter_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success',
  error TEXT NOT NULL DEFAULT '',
  uploaded_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
`;
