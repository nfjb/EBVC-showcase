# MVP plan — EB_Event

- Run: `20260930-131337-2323`
- Started: 2026-09-30T13:13:37.902672Z

## Problem context

Skarv Ventures (fictional), a Pre-Seed/Seed fund in Copenhagen and Berlin (Fund II EUR 90m, tickets EUR 0.5–2m, Nordics and DACH, team of seven), has "412 unreviewed deals" in its CRM inbox arriving via website form, cold email, LinkedIn and warm intros. "The same company often arrives several times under different spellings" and "warm intros must get a reply within three working days". The MVP must show capture → merge → CRM store → hard filters → scoring → human review → top-20 worklist on simulated demo data, with today fixed at 2026-09-30.

## Target stakeholder

A Skarv partner preparing the Monday meeting: they nod when 412 noisy inbound records collapse into one clean company list, the robotics startup shows up once with its four touchpoints, overdue LP intros are escalated, and the top-20 worklist shows why each deal ranks where it does, with every decision logged as a human click.

## Demo walkthrough

1. Run the synthetic data generator and upload the resulting inbound CSV and signals file as a DealFlowUpload; calculate() merges, filters and scores the records.
2. Open the pipeline overview: 412 raw records → merged companies → passed hard filters → top 20, plus open intros past their deadline.
3. Open the robotics showcase company: one company with four touchpoints (website form in June, two partner emails in July, LP intro in August, LinkedIn last week).
4. Open the merge queue and approve one fuzzy-name suggested merge and reject another.
5. Open the intro tracker: an LP intro older than three working days shows 'Escalated to partner' as text plus icon; mark it replied.
6. Open the top-20 worklist, expand one deal's score breakdown, confirm that days in queue shows a 14/21-day flag but does not change the score, override a rank with a comment and export the list to CSV.
7. Pass one deal with a pass code and advance another; show both entries in the audit log with who and when.

## Acceptance criteria

- [ ] The generator is reproducible (fixed seed) and produces 412 raw records for ~300 fictional companies across four channels, with ~25 warm intros and a dated signals file.
- [ ] After the upload runs, the showcase robotics company exists once with four touchpoints and full history.
- [ ] Fuzzy name matches (Jaro-Winkler ≥ 0.92, no conflicting domain) appear only as suggested merges and change nothing until a human approves.
- [ ] Every company that fails a hard filter carries the pass code outside_stage, outside_geography or ticket_mismatch.
- [ ] The score breakdown lists each weighted component from config/weights.yaml; the team and market fields stay empty until a human fills them.
- [ ] A pytest test proves that increasing days in queue leaves the score unchanged, and the worklist shows the 14/21-day flags as text.
- [ ] Warm-intro deadlines are three working days skipping weekends, with day-2 reminder and day-3 escalation states, covered by a pytest test.
- [ ] Every advance/pass decision and rank override is written to the audit log with user, timestamp, decision and pass code.
- [ ] `python -m lex pytest` passes, including tests for domain and name normalisation, the three match rules, the SLA calculation and the hard filters.

## Deliberately out of scope (for `mvp_completion`)

- Weekly freshness re-check (auto-close as missed on competitor-led round, re-rank change notes).
- Pass-response drafts, the template library, 'Approve & mark as sent' and close-the-loop thank-you drafts.
- Retention flag and the anonymise action for passed deals older than 12 months.
- Learning page (decisions by pass code, score vs decision, missed-deal list).
- Optional Claude API for thesis summaries and drafts; the MVP uses deterministic keyword matching against config/thesis.md for the suggested thesis fit.
- Print-friendly Monday-meeting view (CSV export only in the MVP).
- `make demo` target and the full two-minute demo script in the README.

## Inspiration sources

- docs/planning/mvp-spec.md — full user-supplied spec for the Skarv Ventures deal-flow triage tool (2026-09-30).
- User decisions 2026-09-30: build as a Lex MVP (not standalone SQLite/app.py); MVP cut = core pipeline first, rest deferred to mvp_completion.
