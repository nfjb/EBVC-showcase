---
tags: [lex, handbook]
---

# The Lex handbook

This folder is the Lex delivery handbook. It is installed into this project by
LEX AI so the IDE agent working here knows the Lex framework and how LEX AI's
own modes behave.

It is **reference material, not project output**. Nothing in a run should write
into `docs/`.

## Navigation

- [Lex query router](lex_topics/99-QUERY-ROUTER.md) — start here for any Lex question
- [Lex topic map](lex_topics/00-TOPIC-LIST.md) — the focused index
- [Lex specifications](lex_topics/20-LEX-SPECIFICATIONS.md) — canonical framework rules
- [MCP modes](mcp-modes.md) — which mode to use, and how to switch. `brief` is the
  default: it interviews you and switches to the mode the work needs
- [MCP execution model](mcp-execution-model.md) — how a run is executed
- [Example Lex model files](_context/lex_examples/README.md) — pattern references for planning
- [Run log template](runs/run-template.md) — reference shape; the server writes the real log

## Handbook contract

- `docs/` is **read-only** during every run. Agents must never write generated
  output into it.
- For LLM execution context, this handbook plus a connected `lex-mcp` server are
  all that is required.
- Where this handbook contradicts prior model knowledge about Lex, the handbook
  wins.

## Where a run writes

Nothing is written into `docs/`. Generated output lands in three places, and
which one depends on what is being produced:

| Output | Goes to |
| --- | --- |
| Planning documents (steps 0-6, 8-14, 19) | `plans/technical_docs/step-NN-<name>.md` |
| Business documents (backward mode) | `plans/business_docs/` |
| Module pseudocode (step 7) | `technical-map/step-07-pseudocode/` |
| The code wiki (steps 15, 16, 18) | `technical-map/` |
| Per-module context (step 17) | `<module>/CONTEXT.md`, beside the source |
| The run log | `plans/technical_docs/run.md` |
| The final audit report | `plans/technical_docs/audit-report.md` |

Each mode also has its own output directory — `reviews/`, `test-runs/`,
`edits/`, `deployment/`, `input-changes/`, `mvp/`. Those are described in
[mcp-modes.md](mcp-modes.md).

## MCP step execution contract

- Step instructions are loaded from MCP via `get_plan_step`, never from a local
  step file. There is no copy of the step order in this handbook, because a
  second copy only drifts.
- The IDE LLM is a **coordinator**. It calls `get_plan_step`, delegates to the
  matching `lex-step-NN` agent, and calls `notify_step_complete`. It does not do
  step work itself.
- Human approvals are not required to advance between steps.
- Deployment is not part of this loop. It is `deploy` mode, entered when asked.

## How a forward run goes

1. Start from MCP — `kickstart_workflow` for a new project, `kickstart_run` for
   an existing one — then delegate each step to its `lex-step-NN` agent in order,
   without pausing for approval gates.
2. Each step agent writes its output where the table above says. The coordinator
   calls `notify_step_complete` after each step, then loads the next.
3. Continue until every step is complete in the same prompt execution.
4. Call `finalize_workflow()`. It returns audit instructions rather than
   finishing: write `plans/technical_docs/audit-report.md` yourself — this is the
   one step that is not delegated — then call
   `finalize_workflow(audit_complete=True)` to open the pull request.

## Run log

`plans/technical_docs/run.md` is the run log: the single place step status,
decisions, and open questions are recorded for a whole run.

**The server creates and maintains it — do not copy the template over it.** It
is seeded at kickstart and resume, and each box is ticked from
`notify_step_complete`. An existing log is never overwritten, because its ticks
are the state a resumed run depends on.

It is also machine-read, which constrains two things by hand:

- the literal `## Step Status Board` heading must survive any edit;
- so must the `- [ ]` / `- [x]` checkbox format inside that section.

A run counts as complete only when every box in that section is ticked, and that
is what gates switching to backward mode after a resumed run. Record decisions
and answers freely in the other sections — only the board is parsed.
[runs/run-template.md](runs/run-template.md) shows the shape; it is not something
to copy by hand.

## Core system assumptions

- Target code is Python and Django-ish.
- Lex consumes generated files and assembles project structure.
- Django ORM models are the primary source of truth for data and behavior
  boundaries.
- Business logic must be implementable from pseudocode with minimal ambiguity.

## If this project carries older handbook folders

An install from an older LEX AI release may have left `planning/`,
`implementation/`, or `deployment/` phase handbooks in this project. They are no
longer part of this handbook and are not delivered or updated any more, and
nothing removes them automatically. Ignore them; this tree is the current one.
