# Skarv Ventures — deal-flow triage (Next.js)

A deal-flow triage tool for Skarv Ventures, a fictional Pre-Seed/Seed fund (Copenhagen and
Berlin, tickets EUR 0.5–2m, Nordics and DACH), on simulated demo data only. The full brief
is in [`docs/planning/mvp-spec.md`](docs/planning/mvp-spec.md).

412 noisy inbound records (website form, cold email, LinkedIn, warm intros) are merged into
one company list, filtered, scored and turned into a Monday worklist. Every decision is a
logged human click, and replies are drafted but never actually sent.

This branch is a port of the Lex (Django + Streamlit) app on `main` to **Next.js 16 + React
19 + SQLite**. The triage rules are unchanged: on the demo data the port computes exactly
what the Python app computed (see [Fidelity](#fidelity)).

## Run it

Requires Node.js 22 or newer.

```bash
npm install
npm run demo:load   # optional: load demo/inbound_records.csv + demo/signals.csv
npm run dev         # http://localhost:3000
```

The CRM is a SQLite file at `data/skarv.sqlite`, created on first use. Instead of
`demo:load` you can upload the two CSVs on **Deal flow uploads** (or press *Use the bundled
demo files* there). Each upload rebuilds the CRM; the audit log and the Outbox are kept.

```bash
npm test            # unit + integration tests (Vitest)
npm run typecheck
npm run build && npm start
```

## Pages

| Page | What it is for |
| --- | --- |
| **Cockpit** | My view / Team view / Pipeline / Hot topics. KPI tiles double as quick filters; the table is ranked by score % × urgency; CSV export and a print view for the Monday meeting |
| **Priority matrix** | Every open, filter-passing deal on score % × urgency, in four quadrants. Click a bubble to open the deal |
| **Deal detail** | Ratings (thesis fit, market, team), advance / pass with a drafted reply, warm-intro reply and thank-you, score breakdown, touchpoint history, rank override |
| **Intro tracker** | Warm intros against the three-working-day SLA: day-2 reminder, day-3 escalation to the responsible partner |
| **Merge queue** | Fuzzy name matches waiting for a person: same company (merge) or different |
| **Outbox** | Every reply "sent" from the app (simulated: nothing leaves the app) |
| **Audit log** | Every human click, with who and when |
| **Data** | Deal flow uploads, plus read-only views of each table |

There is no sign-in in this demo: pick the team member you are acting as in the sidebar.
Every decision is logged under "<name> (demo)".

## Configuration

All the rules live in `config/` and are read at server start (restart after editing):

- `config/weights.yaml`: score weights, hard filters, queue flags, SLA, urgency, cockpit and
  matrix settings, and the demo's fixed "today" (2026-09-30).
- `config/thesis.md`: the thesis and the keywords behind the suggested thesis fit.
- `config/team.yaml`: the team, their roles and who each escalates to.

Environment variables (all optional, see `.env.example`): `DATABASE_PATH` and `UPLOADS_DIR`.

## Layout

```
config/               the triage rules (weights, thesis, team)
demo/                 the demo CSVs and their generator (_generate.py)
src/lib/triage/       the rules, pure: normalise, dedup, filters, scoring, urgency, drafts…
src/lib/db/           SQLite schema and queries
src/lib/server/       pipeline run, human actions (each writes its audit row), page data
src/app/              the pages and their server actions
src/components/       client components (dialogs, chart, filters, navigation)
tests/unit/           pure-logic tests
tests/integration/    pipeline and human actions over the demo files, on in-memory SQLite
```

## Fidelity

The rules were ported line by line from `Uploads/*.py` and the dashboard modules on `main`.
Where JavaScript differs from Python, the port follows Python: round-half-even rounding
(`round()` and `f"{x:.1f}"`), Unicode `\w`/`\s`/`\b`, `str.split()` and `strip()`
whitespace, code-point string ordering, and rapidfuzz's Jaro-Winkler.

To check this, the original Python modules and the port were run side by side on the demo
data, before and after a deterministic set of edits (ratings, advances, passes, pins,
replied intros). Their outputs were identical on every field compared: companies,
touchpoints, scores and breakdowns, suggested merges, every cockpit line (urgency,
priority, tasks, next action), rankings, tile filters for every owner, matrix positions,
all 2,602 reply drafts, intro states, plus 8,007 Jaro-Winkler pairs, 12,030 rounding cases
and 1,200 working-day cases.

### What changed with the move off Lex

- **Storage**: SQLite (`better-sqlite3`) instead of the Lex-managed PostgreSQL. Same tables,
  same delete rules (a re-upload or merge keeps the audit log and Outbox, with the company
  link set to NULL).
- **Sign-in**: Keycloak/OIDC came with Lex and is not carried over. The demo's "Acting as"
  picker (the Streamlit app's fallback when nobody was signed in) is the only identity.
- **Admin**: the Lex admin's generic editable lists are replaced by read-only table views.
  All changes go through the pages, so each one is logged.
- **Per-row change history** (django-simple-history) is not carried over. The Decision table
  remains the audit log of human clicks, as before.
- **Upload runs** are recorded with their counts *or* their error, and a file that cannot be
  read leaves the CRM untouched. The Python pipeline cleared the CRM before building the new
  companies.
- **Timestamps** in the audit log and Outbox are shown in UTC, as before, and now say so.
- **Data generator**: `demo/_generate.py` stays in Python (`pip install faker`, then
  `python demo/_generate.py`). Its output depends on Python's `random` and Faker, so a port
  would produce different demo data; the generated CSVs are committed.
