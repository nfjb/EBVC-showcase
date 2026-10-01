# Skarv Ventures — deal-flow triage (Next.js)

A deal-flow triage tool for Skarv Ventures, a fictional Pre-Seed/Seed fund (Copenhagen and
Berlin, tickets EUR 0.5–2m, Nordics and DACH), on simulated demo data only. The full brief
is in [`docs/planning/mvp-spec.md`](docs/planning/mvp-spec.md).

412 noisy inbound records (website form, cold email, LinkedIn, warm intros) are merged into
one company list, filtered, scored and turned into a Monday worklist. Every decision is a
logged human click, and replies are drafted but never actually sent.

This branch is a port of the Lex (Django + Streamlit) app on `main` to **Next.js 16 + React
19**, styled with Tailwind CSS and shadcn/ui, running entirely in the browser. The triage rules are unchanged: on the demo data the port computes exactly
what the Python app computed (see [Fidelity](#fidelity)).

## Run it

Requires Node.js 22 or newer.

```bash
npm install
npm run dev         # http://localhost:3000
```

The CRM lives in the browser tab's memory: nothing is written to disk or sent to a server,
so the app is a set of static pages that can be hosted anywhere (Vercel included). The app
opens with the bundled demo files (`demo/inbound_records.csv`, `demo/signals.csv`) already
loaded, listed on **Deal flow uploads** as "Demo data (loaded when the app opened)". Upload
other CSVs there to replace them; each upload rebuilds the CRM and keeps the audit log and
the Outbox. Move between pages with the in-app links: they keep the tab's state, while a
reload starts again from the demo data and drops every click made since.

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
| **Deal detail** | O1 ratings (ten dimensions, 1–5, plus a storytelling bonus) with a live score preview, advance / pass with a drafted reply, warm-intro reply and thank-you, score breakdown, touchpoint history, rank override |
| **Intro tracker** | Warm intros against the three-working-day SLA: day-2 reminder, day-3 escalation to the responsible partner |
| **Merge queue** | Fuzzy name matches waiting for a person: same company (merge) or different |
| **Outbox** | Every reply "sent" from the app (simulated: nothing leaves the app) |
| **Audit log** | Every human click, with who and when |
| **Data** | Deal flow uploads, plus read-only views of each table |

There is no sign-in in this demo: pick the team member you are acting as in the sidebar.
Every decision is logged under "<name> (demo)".

## Configuration

All the rules live in `config/` and are bundled into the app (restart `npm run dev` after editing):

- `config/weights.yaml`: the O1 score weights and interpretation bands, hard filters, queue
  flags, SLA, urgency, cockpit and matrix settings, and the demo's fixed "today" (2026-09-30).
- `config/thesis.md`: the written fund thesis, for reference. It no longer feeds the score.
- `config/team.yaml`: the team, their roles and who each escalates to.


## Layout

```
config/               the triage rules (O1 weights, team; thesis for reference)
demo/                 the demo CSVs and their generator (_generate.py)
src/lib/triage/       the rules, pure: normalise, dedup, filters, scoring, urgency, drafts…
src/lib/db/           the in-memory store and its queries
src/lib/crm/          pipeline run, human actions (each writes its audit row), page data
src/app/              the pages (client components reading the store)
src/components/       client components (dialogs, chart, filters, navigation); ui/ is shadcn/ui
tests/unit/           pure-logic tests
tests/integration/    pipeline and human actions over the demo files, on a fresh in-memory store
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

The one deliberate exception is the score. It no longer follows the Python app's thesis fit,
market, team, momentum and source quality. It now follows the **O1 Venture investment
criteria** (Pre-Seed / Seed, March 2026), described in the next section.

### Scoring: the O1 investment criteria

A person rates ten dimensions from 1 (weak) to 5 (strong) on Deal detail; the weights are the
framework's:

| Dimension | Weight | Dimension | Weight |
| --- | --- | --- | --- |
| Team | 20 % | Traction & validation | 10 % |
| Market opportunity | 15 % | Competition & differentiation | 5 % |
| Problem–solution fit | 15 % | Go-to-market | 5 % |
| Technology & product | 10 % | Financial plan & use of funds | 5 % |
| Business model | 10 % | Exit potential | 5 % |

Score % = sum(weight × rating / 5). Storytelling & design adds 0–5 bonus points, the total
capped at 100 %. Once all ten are rated, the score reads as a band: 90+ investable – strong,
75+ investable with minor gaps, 60+ watchlist, 40+ not investable, below 40 no fit.

Nothing is rated automatically, so every company starts at 0 %. The cockpit then orders
unrated deals by urgency, and shows "–" in the O1 % column until someone rates them. The
matrix's score line sits at 60 % (the watchlist line).

### What changed with the move off Lex

- **Storage**: an in-memory store in the browser tab instead of the Lex-managed PostgreSQL.
  Same tables, same delete rules (a re-upload or merge keeps the audit log and Outbox, with the company
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
