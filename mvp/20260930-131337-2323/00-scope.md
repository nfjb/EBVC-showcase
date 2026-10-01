# MVP scope — EB_Event

- Run: `20260930-131337-2323`
- Started: 2026-09-30T13:13:37.902672Z

## Problem statement

Build a working MVP of a deal-flow triage tool for Skarv Ventures, a fictional Pre-Seed/Seed VC fund (Copenhagen/Berlin, Fund II EUR 90m, tickets EUR 0.5–2m, Nordics and DACH, team of seven), using simulated demo data only. A reproducible synthetic generator produces ~300 fictional companies expanded to 412 raw inbound records across four channels (website form, cold email, LinkedIn, warm intros from LPs/portfolio founders/angels), with duplicate spellings, plus a dated enrichment-signals file. The pipeline is: capture → dedup/merge (exact domain, exact founder email/LinkedIn, fuzzy Jaro-Winkler name ≥0.92 as a suggested merge needing human approval) → CRM store with companies and touchpoints → hard filters (stage, geography, ticket fit, failing reason stored as a pass code) → enrichment → company-only scoring with visible configurable weights (AI-suggested thesis fit, human-only market and team, momentum, source quality; time in queue never raises the score but flags deals at 14 and 21 days; score breakdown; manual rank override with comment) → human review → pass-response drafts from one template library with 'Approve & mark as sent' (never send email) → weekly freshness re-check (competitor-led round auto-closes as missed; hires/traction/news re-rank with change notes) → top-20 worklist. A warm-intro tracker enforces a three-working-day reply SLA with day-2 reminder and day-3 partner escalation and a close-the-loop thank-you draft. Compliance: no founder scoring, every advance/pass decision is a logged human click (audit table), and a retention flag with an anonymise action for passed deals older than 12 months. The Streamlit UI (British English, WCAG AA, status never by colour alone) has pages for pipeline overview, merge queue, intro tracker, top-20 worklist with CSV export and print view, deal detail, and learning. Optional Claude API for thesis summaries/pass drafts only when ANTHROPIC_API_KEY is set, with deterministic offline templates otherwise. pytest covers normalisation, the three match rules, the working-day SLA, hard filters, and that time in queue does not affect score; README includes setup, a demo command and a two-minute demo script. Treat today as 2026-09-30. Full spec: docs/planning/mvp-spec.md.

## Core requirements (10/10)

1. Generate reproducible synthetic data: ~300 fictional companies as 412 inbound records over four channels (June–September 2026) with spelling duplicates, ~25 warm intros and a dated signals file.
2. Upload the inbound CSV and signals file and run the pipeline in one step: merge records, apply hard filters and score companies, keeping every original record as a touchpoint.
3. Merge records automatically on exact normalised domain, then on exact founder email or normalised LinkedIn URL.
4. Flag fuzzy company-name matches (Jaro-Winkler ≥ 0.92, no conflicting domain) as suggested merges that a human approves or rejects in a merge queue; never merge them silently.
5. Pass or fail each company on stage (Pre-Seed, Seed), geography (Nordics, DACH) and ticket fit (EUR 0.5–2m), storing the failing reason as a pass code.
6. Score companies only, never founders, with weights from config/weights.yaml (suggested thesis fit, human-only market and team, momentum, source quality) and show the score breakdown per deal.
7. Keep time in queue out of the score and instead flag deals at 14 days ('decide this week') and 21 days ('decision required at next meeting').
8. Track warm intros with a three-working-day deadline that skips weekends, a day-2 reminder, a day-3 partner escalation and an open/replied/closed status.
9. Show a top-20 worklist of filter-passing open deals ranked by score, with CSV export and a manual rank override that requires a comment.
10. Record every advance or pass decision and rank override as a human click in an audit log with who, when, decision and pass code.

## Entity map (5/5)

### Company — Input
- `name: CharField`
- `website_domain: CharField`
- `country: CharField`
- `stage: CharField`
- `round_size_eur: IntegerField`
- `pass_code: CharField`
- `score: FloatField`
- `owner: CharField`

### Touchpoint — Input
- `company: ForeignKey`
- `channel: CharField`
- `received_at: DateField`
- `recipient: CharField`
- `company_name: CharField`
- `introducer_name: CharField`
- `introducer_type: CharField`
- `intro_status: CharField`

### MergeSuggestion — Input
- `company: ForeignKey`
- `candidate: ForeignKey`
- `similarity: FloatField`
- `status: CharField`
- `decided_by: CharField`
- `decided_at: DateField`

### Decision — Input
- `company: ForeignKey`
- `decision: CharField`
- `pass_code: CharField`
- `comment: CharField`
- `decided_by: CharField`
- `decided_at: DateField`

### DealFlowUpload — Upload
- `inbound_file: FileField`
- `signals_file: FileField`
- `raw_record_count: IntegerField`
- `company_count: IntegerField`
- `passed_filter_count: IntegerField`
- _Dumb calculation:_ read the inbound CSV and signals file, merge records into companies and touchpoints, apply hard filters and score companies

## Rationale

Five tables carry the core pipeline: Company (the merged CRM record), Touchpoint (every raw inbound record, which also carries warm-intro status for the intro tracker), MergeSuggestion (the fuzzy-match confirmation queue), Decision (the human-click audit log, including rank overrides) and DealFlowUpload (the one calculate() that runs merge, filters and scoring over the generated CSV and signals file). Raw founder and deck fields and the score breakdown are extra fields the implementer adds beyond the eight shown in the sidebar. The top-20 worklist, overview and intro tracker are Streamlit views over these tables rather than extra Report models. The freshness re-check, response drafts, retention and anonymise, Learning page, Claude API and print view are deferred to mvp_completion, as agreed with the user.
