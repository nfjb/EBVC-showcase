# Triage the Backlog — the five problems (Earlybird "Finance for AI", Challenge 3)

Source: challenge sheet photographed by the user, 2026-09-30. Fictional scenario:
Skarv Ventures, Pre-Seed/Seed, Copenhagen and Berlin, Fund II EUR 90m, tickets
EUR 0.5–2m, Nordics and DACH, team of seven. 412 unreviewed deals in the CRM inbox;
the partners want a prioritised top-20 worklist for Monday's meeting and a way to keep
the inbox at zero. "We don't have a deal flow problem. We have a deal attention problem."

Deliverable: a one-page workflow sketch and the format of the top-20 worklist; bonus for a
first working piece (such as the dedup step or the intro tracker).

## 1. The same deal arrives four times
A robotics startup used the website form in June, cold-emailed two partners in July, was
introduced by an LP in August and messaged an associate on LinkedIn last week. The CRM holds
three entries under two spellings; nobody knows it is one company.

**In the MVP now:** exact merge on normalised domain, then founder email / LinkedIn; fuzzy
name matches (Jaro-Winkler ≥ 0.92) go to a merge queue for a person. Robotix AI → one
company, five touchpoints.

## 2. Fit is not a checkbox
Every deck says "AI-first". Stage, geography and ticket size are easy to filter. Whether a
company fits the thesis, whether the team is credible and whether the market is real needs
judgement. Three partners apply three different standards, and past pass reasons range from
"too early" to "meh".

**In the MVP now:** automatic hard filters (stage, geography, ticket = 40 % of round);
thesis fit suggested by keyword match and confirmed by a person; market and team human-only;
fixed pass-code list.

## 3. Warm intros carry obligations
An intro from an LP or a portfolio founder must get a reply within days, regardless of fit.
Nobody tracks who introduced whom. Last month a portfolio CEO learned from the founder that
his intro had never been answered.

**In the MVP now:** intro tracker with three-working-day deadline, day-2 reminder, day-3
escalation to the responsible partner, open / replied / closed status.

## 4. The good ones are already gone
A deal that has been sitting for six weeks has since announced a round led by a competitor.
Priorities change while the backlog waits: funding news, hires and traction updates are
public, but nobody re-checks the queue.

**In the MVP now:** signals known at intake feed momentum; 14/21-day queue flags. The weekly
re-check is **not built yet**.

## 5. Saying no at scale, without damage or legal risk
Around 90 % of inbound will be a pass. Passes must be timely, personal enough not to end up
on social media, and consistent across partners. Founder data may not be kept indefinitely,
and any automated ranking of individuals is a legal grey zone under GDPR and the AI Act: the
machine may sort companies, but people make the decision.

**In the MVP now:** companies scored, never founders; every decision a logged human click.
Pass drafts, "Approve & mark as sent", retention flag and anonymise are **not built yet**.

## The plan must cover
Intake · Criteria · Prioritisation · Freshness · Response · Learning ("the less, the better").

## Questions and answers
(Filled in from the user's answers, 2026-09-30.)

| # | Question | User's answer (2026-09-30) |
|---|----------|----------------------------|
| 4 | Re-check finds a round led by another investor | **Flag, person confirms.** The deal is flagged "Likely missed: round led by X" at the top of the worklist; a person clicks "Close as missed" (logged). Hires / traction / news re-rank with a change note. |
| 2 | Three partners, three standards | **Shared rubric, one rating.** Each 1/2/3 level of thesis fit, market and team has a written definition in config, shown next to the input. |
| 5 | Pass-email drafts | **Templates + optional Claude.** One template library per pass code (2–3 sentences, named reason, signed by the person originally contacted). Claude personalises the wording only when `ANTHROPIC_API_KEY` is set. A person clicks "Approve & mark as sent"; nothing is ever emailed. |
| 5 | Founder-data retention | **12 months, configurable.** Passed deals older than that are flagged; a person clicks "Anonymise" (removes founder name / email / LinkedIn and deck text, keeps company data and pass code). |
| 3 | Closing the loop with the introducer | **Thank-you draft + introducer view.** On a decision, draft a thank-you / outcome note to the introducer (approve & mark as sent); a per-introducer view lists every intro and its status. |
| 1 | Auto-merge on exact identifiers | **Keep.** Exact domain / email / LinkedIn matches merge automatically; fuzzy names still need approval. |
| — | Learning page | **Show, don't auto-tune.** Decisions by pass code, score vs decision, missed deals, per-partner pass-reason mix. People edit `config/weights.yaml` themselves. |
| — | Open MVP run | **Switch to edit mode now**, leaving the MVP run unfinalised. |
