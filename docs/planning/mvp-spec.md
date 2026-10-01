# MVP spec — Skarv Ventures deal-flow triage (as supplied by the user, 2026-09-30)

Build a working MVP for a VC deal-flow triage tool, using simulated demo data only.

## Context
Skarv Ventures (fictional) is a Pre-Seed/Seed fund in Copenhagen and Berlin.
Fund II: EUR 90m. Tickets: EUR 0.5–2m. Geography: Nordics and DACH.
Team of seven: three partners, two principals, two associates.
The CRM inbox holds 412 unreviewed deals. Inbound arrives via four channels:
website form, cold email to partners, LinkedIn messages, warm intros
(from LPs, portfolio founders and angels). The same company often arrives
several times under different spellings. Warm intros must get a reply
within three working days. Treat "today" as 2026-09-30.

The goal is a demo that shows the full pipeline:
capture → merge → CRM store → hard filters → enrichment → scoring →
human review → response drafts → freshness re-check → top-20 worklist.

## Tech stack
- Python 3.11, Streamlit for the UI, SQLite as the "CRM" store
- rapidfuzz for fuzzy matching, pandas, Faker for synthetic data
- pytest for tests
- Optional: Anthropic API (Claude) for thesis summaries and pass-email drafts,
  only if ANTHROPIC_API_KEY is set. Without a key, fall back to
  deterministic templates so the demo always runs offline.

## 1. Synthetic data generator (data/generate.py)
Generate reproducible data (fixed random seed):
- ~300 unique fictional companies, expanded to 412 raw inbound records
  across the four channels, dated June–September 2026.
- ~40 companies appear 2–4 times: different channels, name spelling variants
  ("Robotix AI", "Robotix", "RobotiX GmbH"), sometimes with "www." or
  trailing slashes in the domain, sometimes only a founder email or
  LinkedIn URL in common. Include one showcase case: a robotics startup
  that used the website form in June, emailed two partners in July,
  got an LP intro in August and messaged an associate on LinkedIn last week.
- Fields per raw record: record_id, channel, received_at, recipient,
  company_name, website, founder_name, founder_email, founder_linkedin,
  country, stage, round_size_eur, one_liner, deck_text (short fake text),
  introducer_name, introducer_type (LP / portfolio_founder / angel / none).
- Realistic mix: roughly half should fail hard filters (wrong stage,
  outside Nordics/DACH, ticket mismatch).
- ~25 warm intros, several already older than three working days.
- A separate signals file (enrichment mock) with dated events per company:
  round_announced (with lead investor, some led by "competitor" funds),
  senior_hire, traction_update, news. Some events dated after the deal
  arrived, so the freshness check has something to find.
- All names, companies, LPs and funds must be clearly fictional.

## 2. Dedup / merge (pipeline/dedup.py)
Match in this order:
1. Exact match on normalised domain (lowercase, strip protocol, www.,
   paths, trailing slashes).
2. Exact match on founder email or normalised LinkedIn URL.
3. Fuzzy match on normalised company name (strip legal suffixes such as
   GmbH, AB, ApS, AS, Oy, AG, Ltd, and tokens like "Labs", "AI",
   punctuation) using Jaro-Winkler. Score ≥ 0.92 with no conflicting
   domain → flag as "suggested merge", never merge silently.
Output: companies table (one row per company) plus a touchpoints table that
keeps every original record with channel, date and recipient.
Merged companies show a touchpoint count and full history.
Suggested merges go to a confirmation queue in the UI (approve / reject).

## 3. Hard filters (pipeline/filters.py)
Automatic pass/fail on stage (Pre-Seed, Seed), geography (Nordics: DK, SE,
NO, FI, IS; DACH: DE, AT, CH) and ticket fit (implied ticket within
EUR 0.5–2m). Store the failing reason as a pass code.

## 4. Scoring (pipeline/scoring.py)
*Changed 2026-10-01: the score is now the Fathom investment criteria (ten dimensions,
1–5, weighted; see README "Scoring"), pre-rated by an AI agent and adjustable by people. The
components below are the original brief.*
Score companies only, never individuals. Components with weights defined
in one visible config file (config/weights.yaml):
- thesis_fit (1–3): AI-suggested from deck_text against a short written
  thesis in config/thesis.md, marked "suggested" until a human confirms
- market (1–3) and team (1–3): human-only fields, empty by default;
  the team field must never be filled automatically
- momentum: from enrichment signals
- source_quality: warm intro > cold, configurable
Time in queue must NOT raise the score. Instead flag deals at 14 days
("decide this week") and 21 days ("decision required at next meeting").
Show a score breakdown per deal so users can see why it ranks where it does.
Allow a manual rank override with a required comment.

## 5. Two lanes
- Lane A — Intro tracker: all warm intros with introducer, introducer type,
  date, owner, deadline (three working days, skip weekends), status
  (open / replied / closed), and escalation state (day 2: reminder to owner,
  day 3: escalate to responsible partner). Include a "close the loop"
  action that drafts a thank-you note to the introducer.
- Lane B — Top-20 worklist: filter-passing, open deals ranked by score.
  *Changed 2026-10-01: ranked by priority = Quality Score × Urgency Score / 100; the
  Urgency Score has five dimensions (reply obligation, relationship, activity signal,
  competitive pressure, founder momentum), never time in queue. See README.*

## 6. Freshness check (pipeline/freshness.py)
A "Run weekly re-check" button that applies new signals:
- round announced by another lead → auto-close as "missed", log it
- hire / traction / news → re-rank and show a change note
  ("Hired ex-ABB CTO, Sep 2026, moved from #9 to #4")

## 7. Responses (pipeline/responses.py)
Fixed pass-code list: outside_stage, outside_geography, ticket_mismatch,
outside_thesis, market_too_small, portfolio_conflict,
too_early_revisit_6m, other (comment required).
Generate a short, personal draft per pass (two or three sentences, named
reason, signed by the person originally contacted). A human must click
"Approve & mark as sent". Never send real email; only mark status.
Keep one template library so tone is consistent.

## 8. Compliance features
- No automated scoring or ranking of founders.
  *Changed 2026-10-01 (product decision): an AI agent pre-rates every company on the Fathom
  criteria, including the Team dimension, from company-level information only (no names or
  personal data); people can override any rating, and the agent never overwrites them.*
- Every advance/pass decision requires a human click and is logged in an
  audit table (who, when, decision, pass code).
- Retention: flag passed deals older than 12 months (configurable) and
  offer an "anonymise" action that removes personal fields but keeps
  company-level data and the pass code.

## 9. Streamlit UI (app.py), pages:
1. Pipeline overview: counts at each stage (412 raw → merged → passed
   filters → top-20), missed deals, open intros past SLA.
2. Merge queue: suggested merges with side-by-side records, approve/reject.
3. Intro tracker (Lane A).
4. Top-20 worklist (Lane B) with these columns: rank, company + website,
   one-liner, stage · round · ask, geography, source + introducer,
   touchpoints, days in queue (with 14/21-day flags), hard filters,
   thesis · market · team, latest signal, owner, next action + deadline,
   decision. Export to CSV and a print-friendly view for the Monday meeting.
5. Deal detail: touchpoint history, score breakdown, rating inputs,
   decision buttons, draft response.
6. Learning: decisions by pass code, score vs decision comparison,
   missed-deal list.
UI text in British English. Meet WCAG AA contrast (4.5:1). Never use
colour alone to convey status: always pair with a text label or icon.

## 10. Quality
- pytest tests for domain normalisation, name normalisation, the three
  match rules, working-day SLA calculation, hard filters and the rule that
  time in queue does not affect score.
- README with setup, `make demo` (generate data + run pipeline + start app)
  and a two-minute demo script walking through the robotics-startup case,
  an overdue LP intro and a deal closed as missed.
- Keep modules small and readable; no over-engineering.

Start by proposing the folder structure and data model, then build step by
step, running the tests after each module.
