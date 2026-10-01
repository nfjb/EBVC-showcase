---
tags: [run-log, planning]
status: draft
---

# Run — {{date}} — {{project-name}}

> Reference shape for `plans/technical_docs/run.md`, the run log: the one place
> step status, decisions, and open questions are recorded for the whole run.

**Do not copy this file by hand.** The server creates the run log at kickstart
and at resume, and ticks each box from `notify_step_complete`. A hand-copied
board would be wrong for completion mode, whose board starts at step 9 rather
than step 0. This file exists to document the shape and explain why it is fixed.

Do not rename the `## Step Status Board` heading and do not change the `- [ ]`
checkbox format. The server parses them, and treats the run as complete only
when every box in that section is ticked. That gates the switch to backward mode
on resumed runs, where in-memory step state is gone. Record decisions and answers
freely in the other sections — only the board is parsed.

## Metadata

- Owner:
- Participants:
- Lex Context Version:
- Scope:
- Run Path: `plans/technical_docs/`

## Step Status Board

One box per step, 0-19. A completion-mode board starts at step 9 instead: it
assumes the planning artefacts for steps 0-8 are already in
`plans/technical_docs/`. An MVP run does not produce them, so coming from an MVP
those documents have to be written by hand before completion mode starts.

- [ ] Step 0 — Project Overview
- [ ] Step 1 — Input/Output File Schemas
- [ ] Step 2 — Requirements and End Goals
- [ ] Step 3 — Central User Story
- [ ] Step 4 — Architecture and Data Flow
- [ ] Step 5 — Functional Breakdown and Information Mapping
- [ ] Step 6 — UML + ER + State Machine Diagrams
- [ ] Step 7 — Business Logic Pseudocode
- [ ] Step 8 — Rule Compliance Validation
- [ ] Step 9 — Implementation Planning
- [ ] Step 10 — Blueprint Consolidation, Release Readiness, and Plan Compliance
- [ ] Step 11 — Full Project Implementation (Code Delivery)
- [ ] Step 12 — Initial Data Upload Plan
- [ ] Step 13 — Streamlit Capabilities Execution Plan
- [ ] Step 14 — Code-Level Lex Rule Compliance Validation
- [ ] Step 15 — Technical-Map Architecture & Module Discovery
- [ ] Step 16 — Technical-Map Convention & Pattern Extraction
- [ ] Step 17 — Technical-Map Per-Module CONTEXT
- [ ] Step 18 — Technical-Map Synthesis, Data Sources & Cross-Referencing
- [ ] Step 19 — Forward ↔ Backward Doc & Code Synchronization

## Decisions Log

| Date | Decision | Why | Impacted Steps |
| --- | --- | --- | --- |
| ... | ... | ... | ... |

## Open Questions

Mirror of `plans/technical_docs/questions-to-user.md`, which the step agents
append to when they need an answer to proceed.

- ...

## Artifact Links

Each step writes `plans/technical_docs/step-NN-<name>.md`.

- I/O schemas:
- Requirements:
- User story:
- Architecture:
- UML / ER:
- Pseudocode:
- Implementation outputs:
- Technical map:

## Workflow Completion

- Planning complete (steps 0-8): Yes / No
- Implementation complete (steps 9-14): Yes / No
- Technical map and sync complete (steps 15-19): Yes / No
- Date:
