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
| **Cockpit** | My view / Team view / Pipeline / Hot topics. KPI tiles double as quick filters; the table is ranked by Importance Score × Urgency Score; CSV export and a print view for the Monday meeting |
| **Priority matrix** | Every open, filter-passing deal on Importance Score × Urgency Score, in four quadrants. Click a bubble to open the deal |
| **Deal detail** | Fathom ratings (ten dimensions, 1–5, plus a storytelling bonus) with a live score preview, advance / pass with a drafted reply, warm-intro reply and thank-you, score breakdown, touchpoint history, rank override |
| **Intro tracker** | Warm intros against the three-working-day SLA: day-2 reminder, day-3 escalation to the responsible partner |
| **Merge queue** | Fuzzy name matches waiting for a person: same company (merge) or different |
| **Outbox** | Every reply "sent" from the app (simulated: nothing leaves the app) |
| **Audit log** | Every human click, with who and when |
| **Data** | Deal flow uploads, plus read-only views of each table |

There is no sign-in in this demo: pick the team member you are acting as in the sidebar.
Every decision is logged under "<name> (demo)".

## AI rating agent (optional)

The live Fathom agent uses OpenAI, for deals the pre-rated demo data does not cover. Copy `.env.example` to `.env.local`
(ignored by git), set `OPENAI_API_KEY` and restart `npm run dev`; on Vercel, set it as an
environment variable. `OPENAI_MODEL` is optional (default `gpt-6.1-sol`).

The key stays on the server: `src/app/api/rate` is the app's only server code, and it stores
nothing. Only company-level facts are sent (no founder names, email addresses, LinkedIn
profiles or introducer names). The agent never advances or passes a deal. Without a key,
deals the bundled file does not cover stay unrated.

Before deploying publicly, put the app behind a password or rate limit: the route spends the
key's credits for anyone who can reach it.

## Configuration

All the rules live in `config/` and are bundled into the app (restart `npm run dev` after editing):

- `config/weights.yaml`: the Fathom score weights and interpretation bands, hard filters, queue
  flags, SLA, urgency, cockpit and matrix settings, and the demo's fixed "today" (2026-09-30).
- `config/thesis.md`: the written fund thesis, for reference. It no longer feeds the score.
- `config/team.yaml`: the team, their roles and who each escalates to.


## Layout

```
config/               the triage rules (Fathom weights, team; thesis for reference)
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
market, team, momentum and source quality. It now follows the **Fathom investment
criteria**, described in the next section.

### Scoring: the Fathom investment criteria

The **Fathom agent** (an OpenAI model) rates every company on ten dimensions from 1 (weak) to 5
(strong) right after each upload, and justifies the result in three sentences, shown on Deal
detail as "Why it ranks here". Anyone can change a rating there; a person's ratings replace
the agent's and are never overwritten by it. The weights are the framework's:

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

The demo companies come **pre-rated** in `demo/fathom_ratings.json`, so the app opens fully
rated and never calls OpenAI for them. The ratings were made by Claude, written down as a
reviewable rubric in `scripts/prerate-demo.ts` (a per-sector assessment of the deck text,
moved by each company's hires, traction and announced rounds). Rerun it, without any API
call, when the demo files change:

```bash
npm run demo:prerate
```

Companies the file does not cover (any other upload) are rated by the live agent (OpenAI)
only when someone presses **Rate with the Fathom agent** on Deal flow uploads, since it
spends credits; a progress bar shows at the top of every page while it runs. A deal nobody has rated yet scores 0 %, shows "–" in
the cockpit's Importance Score column (the Fathom score %), and is ordered by urgency. The matrix's score line sits at 60 %
(the watchlist line).

The agent sees company-level information only: deck text, one-liner, stage, round, channels,
introducer types and the enrichment signals. It rates the team on what the deck and signals
say about the team (roles, experience, senior hires), never on names or personal attributes.

### Urgency Score and priority

The **Urgency Score** says how pressing a deal is. It is built like the LP scoring matrix:
five dimensions with point tables, a raw sum out of 120, normalised to 0–100 and always
reported both ways, e.g. `63/100 (raw 75/120)`. It comes from obligations, relationships and
news, never from how long a deal has waited (that only raises the 14/21-day flags). The logic
is in `src/lib/triage/urgency.ts`; every number is in `config/weights.yaml` → `urgency`.

| Dimension | Max | Points |
| --- | --- | --- |
| Reply obligation | 40 | open warm intro overdue 40, due today 36, reminder 30, open 24; none 0 |
| Relationship proximity | 20 | warm intro 20, contact on two or more channels 10, a single cold inbound 4 |
| Activity signal | 25 | latest signal within 14 days 25, 45 days 16, 90 days 8, 180 days 3 |
| Competitive pressure | 20 | latest signal (within 90 days): round announced by another lead 20, traction 14, senior hire 10, news 6 |
| Founder momentum | 15 | latest inbound within 7 days 15, 21 days 8 |

`Urgency Score = round(raw / 120 × 100)`. Tiers: 80+ act today, 60–79 this week, 40–59 soon,
20–39 monitor, below 20 no rush. No score is ever 0: a single cold inbound scores 4 raw.

**Priority** (the Total Score column) = Importance Score × Urgency Score / 100. The cockpit
ranks by priority, then Importance Score, then Urgency Score, then name; a rank pinned by a
person keeps its place. The priority matrix splits Urgency Score at 40, where the "Soon" tier
starts: open warm intros land above it.

The page **How scores work** in the app explains both scores in full, with live examples.

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
