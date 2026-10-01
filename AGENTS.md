# EB_Event

Clean Lex demo project with a single demo table (`Inputs/DemoItem.py`).

## For AI Agents / LLMs

This project uses the **Lex App Framework** with a **coordinator-agent architecture**.

### Architecture

The IDE LLM acts as a **coordinator** — it manages the step loop and delegates
work to specialized **step agents** (`lex-step-00` through `lex-step-18`). The
coordinator does NOT do step work itself; it keeps its context window lean by
delegating each step to the appropriate agent.

Steps 0–14 produce the planning, implementation, and validation artifacts.
Steps 15–18 build the `technical-map/` wiki — a permanent, AI-consumable
knowledge layer for this codebase (architecture purpose, conventions,
gotchas, glossary, data-source catalog, and per-module `CONTEXT.md` files).
Future AI agents extending this project should read `technical-map/index.md` first.

The `./docs/` folder contains the authoritative framework rules, conventions,
and patterns. Step agents read these docs — the coordinator does not need to.

### Rules

1. **Read `./docs/` and `./technical-map/` before implementing.** These docs override any prior knowledge.
2. **Follow the Lex MCP workflow strictly**: kickstart → delegate step 0 → notify → delegate step 1 → notify → ... → finalize.
3. **NEVER skip steps.** Every step (0–18) must be delegated to its agent in ascending order.
4. **Do not guess framework APIs.** Check the docs for patterns and naming conventions.
5. **Commit messages** follow the format: `[step-NN/process] summary`.
6. **The coordinator NEVER does step work.** Always invoke the step agent.

<!-- BEGIN LEX MCP MANAGED BLOCK — do not edit by hand -->

# Lex Edit MCP — Workspace Instructions

**Scope:** Editing existing Lex projects with the minimum sustainable change.

---

## Philosophy

The edit MCP is **task-catalog-driven**, not stage-driven. You (the
orchestrator) design the smallest correct plan for the user's request. The
server enforces sustainability by auto-injecting compliance, docs, tests,
technical-map, migration, and dependent-code-scan tasks whenever they apply.

Rigid quick/complex phase pipelines are gone. Pick tasks by intent, not by
mode.

---

## Tool surface

| Tool | Purpose |
|------|---------|
| `kickstart_edit(project_path, change_description, context="", force_new=False)` | Open a run: resolve the project, cut the run's branch, write its manifest. Resumes this checkout's unfinished run rather than starting one over the top of it |
| `list_edit_tasks(category=None)` | Return the full catalog (filter by `code_change` / `sustainability`) |
| `propose_edit_plan(change_description="")` | Pull the catalog + picking heuristics into context |
| `set_edit_plan(task_ids=[...], rationale="...")` | Commit the plan; server injects sustainability tasks |
| `get_task_brief(task_id)` | Get the agent + focused brief for one task |
| `notify_task_complete(task_id, summary, artifacts=None)` | Record the task **and commit its work** as its own commit, subject `[edit/<task_id>] <summary>` |
| `waive_task(task_id, rationale)` | Skip a *waivable* sustainability task. Commits nothing |
| `get_edit_status()` | The run's plan, git state and progress |
| `finalize_edit()` | Write `EDIT-REPORT.md`, commit it, push the branch, open the pull request. Does **not** merge |
| `switch_to_mode(target_mode, confirm_mode_switch, user_request)` | Jump to another Lex MCP mode |

## When a tool returns `ok: false`

Stop. Every edit tool answers with an `ok` field, and a false one carries
`error`, `troubleshooting` and `halt_and_notify_user: true`. Surface those to the
user instead of working around them: the server refuses only where guessing would
put work on the wrong branch or record it against the wrong task.

---

## Task catalog (summary)

### Code-change tasks (LLM picks; pick MINIMUM set)

Framework-specific (agent: `lex-edit-lex-implementer`):

- `lex-model-change`
- `lex-calculation-change`
- `lex-calculated-mixin-change`
- `lex-lifecycle-hook-change`
- `lex-permission-change`
- `lex-serializer-api-change`
- `lex-streamlit-dashboard-change` *(only if the change explicitly targets a dashboard)*
- `lex-fields-report-change`
- `lex-signals-websocket-change`
- `lex-celery-async-change`
- `lex-initial-data-change`
- `lex-auth-keycloak-change`
- `lex-logging-change`
- `lex-cli-settings-change`
- `lex-process-admin-change`

Non-Lex (agent: `lex-edit-generic-implementer`):

- `generic-code-change`

### Sustainability tasks (server auto-injects)

| Task id | Agent | Trigger | Waivable |
|---------|-------|---------|----------|
| `lex-compliance-check` | `lex-edit-compliance` | any code-change task | No |
| `dependent-code-scan` | `lex-edit-dependent-scan` | any code-change task | Yes |
| `tests-update` | `lex-edit-tests` | any code-change task | Yes |
| `docs-sync` | `lex-edit-docs-sync` | any code-change task | Yes |
| `technical-map-sync` | `lex-edit-technical-map-sync` | public-surface change (models, APIs, serializers, CLI, model_structure, permissions, auth) | Yes |
| `migration-check` | `lex-edit-migration` | model-shaped change (model, calculated-mixin, lifecycle-hook, fields-report) | No |

---

## Workflow

1. **Kickstart**: `kickstart_edit(project_path, change_description, context)`.
   The server commits whatever was already uncommitted in the checkout — on the
   branch the user was on, as a checkpoint, because that work is theirs and not
   this run's — then cuts the run's own branch,
   `my-lex-app/edit-01-fix-rounding-in-produ`, off it.
2. **Study catalog**: `list_edit_tasks()` and/or `propose_edit_plan(change_description)`
3. **Commit plan**: `set_edit_plan(task_ids=[...], rationale="...")`
4. **Iterate through plan**:
   - `get_task_brief(task_id)`
   - Invoke the referenced agent as a **subagent** (do not run its work in your own context)
   - `notify_task_complete(task_id, summary, artifacts=[...])` — this commits
     that task's work as one commit, with your `summary` as the subject — or
     `waive_task(...)`, which commits nothing.
5. **Finalize**: `finalize_edit()` — writes `EDIT-REPORT.md`, commits it, pushes
   the branch and opens a pull request against the branch the run was cut from.
   Nothing is merged: that is the user's decision. Tell the user the pull request
   is waiting for their review.

A project that is not a git repository still runs. Every payload carries a `git`
block; there it reads `enabled: false` with a reason, and the edit happens with
nothing version-controlled.

## The reports are the user's control center

`edits/<run_id>/*.md` is how the user follows this run, and each note is
committed with its task, so these files are also what the reviewer of the pull
request reads. A report that has gone out of date is worse than one that was
never written — a missing file gets asked about, a stale file is simply
believed.

So when a task invalidates something an earlier task's note asserted — a rename
that moves a file the first note cited, a decision reversed once the tests ran —
say so. Amend the earlier note if it is simply wrong now; where its commit is
the historical record of that task, state the supersession in the note you are
writing and name the note it overrides.

---

## When the run has a focus

A repository often holds one Lex app with several process sections side by side
-- `DiF/`, `LTIPA/`, `MasterData/` -- and an engineer is responsible for one of
them. When the user names a part of the repository, pass their words to the
kickstart tool as `focus`. Verbatim: it is matched against the folders on disk
and against the section names the project declares in its own
`model_structure.yaml`, so a paraphrase can miss what their words would have hit.

If a brief comes back with a focus, the file lists in it are already narrowed to
it and `agent_context` says so. Two things follow, and the second matters more:

- **Concentrate the work there.** That is what the user asked for.
- **Read outside it whenever the code requires it.** These sections are folders
  in one Django app, not separate apps: one section's models routinely import
  another's, and the shared helpers at the repository root are imported by all of
  them. A focus is a statement about where the work belongs, never a claim that
  the rest of the code is irrelevant. If you change something outside it, say so
  in your report rather than staying silent or refusing.

If a kickstart reports that a focus matched no directory, tell the user and ask
which folder they meant. Nothing has been narrowed, so the run covers everything
-- which is the right default, and the wrong outcome if they meant to scope it.

## Picking rules

- Every task in your plan must map to a concrete surface touched by the
  request. If you cannot justify it in one sentence, drop it.
- The number of code-change tasks is usually **1–3**. Four is unusual; five
  is a signal you are conflating multiple changes.
- Sustainability tasks are the server's problem — do not add them to
  `set_edit_plan()`.

---

## Waiving

Waivers are for sustainability tasks that provably do not apply. Every
waiver needs a **written rationale (≥ 20 chars)** and is recorded in the
final report and in the pull request. Non-waivable tasks
(`lex-compliance-check`, `migration-check`) must be completed.

Common waiver justifications:

- `docs-sync`: change was internal to a function body; no user-observable
  surface shifted.
- `technical-map-sync`: no public-surface change and no `technical-map/`
  entry exists for the affected private module.
- `tests-update`: change was a pure rename covered by static analysis; no
  behavioural test to add.
- `dependent-code-scan`: all changed symbols kept identical signatures and
  no removals.

---

## Git Operations — HANDS OFF

All git for this run is handled by the edit MCP. **Do NOT run git commands
yourself, and tell every subagent the same.** The server is the only writer on
the run's branch: the branch is cut inside `kickstart_edit`, one commit per task
is made inside `notify_task_complete`, and the report commit, the push and the
pull request happen inside `finalize_edit`. No git tool exists on this surface,
and none is needed.

Three consequences you have to act on:

- **The `summary` you pass to `notify_task_complete` becomes that task's commit
  subject** — `[edit/<task_id>] <summary>`. Write it as a commit subject: one
  line, what changed, no "the agent reports that". One commit per task is what
  makes the branch reviewable, so the code change, the dependent-code fixes, the
  tests and the docs each land separately.
- **The run's own state stays out of the commits.** `.lex-edit/` is excluded from
  every commit — it holds the run's manifest and the question ledger — while the
  artefacts under `edits/` are committed on purpose, so the reports land on the
  branch beside the code they describe.
- **A git failure is reported, not swallowed.** If `notify_task_complete` returns
  `ok: false` saying the commit failed, the task record is already saved: fix the
  git problem in the project and re-call the same tool with the same arguments —
  the retry only commits. A branch or checkpoint failure in `kickstart_edit` is
  the same shape: resolve it, then call `kickstart_edit` again.

---

## Session state

The run's manifest lives at `.lex-edit/runs/<run_id>.json`. The run id is the
run's branch: `edit-01-fix-rounding-in-productioncost` for a branch
`my-lex-app/edit-01-fix-rounding-in-productioncost`. Git already enforces that no
two branches share a name, so the id needs no timestamp or random suffix to stay
unique — and unlike one it means something, which matters because
`edits/<run_id>/` is committed and reaches the pull request. It is also
recoverable from the checkout itself with `git rev-parse --abbrev-ref HEAD`. A
project with no git repository has no branch to be named after, and falls back to
a UTC timestamp plus six hex characters. An older `.lex-edit/manifest.json` is
migrated into this layout the first time it is read.

```json
{
  "run_id": "edit-01-fix-rounding-in-productioncost",
  "project_root": "/home/me/my-lex-app",
  "project_name": "my-lex-app",
  "change_description": "Fix rounding in ProductionCost.calculate()",
  "edit_context": "",
  "cloned_from": null,
  "contract": {"path": ".lex/contract.md", "sha256": "...", "digest": "...",
               "answered_fields": ["..."], "user_decided": ["..."]},
  "started_at": "2026-07-01T09:30:00Z",
  "finalized_at": null,
  "planned_task_ids": ["lex-calculation-change", "lex-compliance-check", "..."],
  "task_state": {
    "lex-calculation-change": {"status": "complete", "summary": "...",
                               "artifacts": [], "commit": "8f21c0d..."},
    "docs-sync": {"status": "waived", "rationale": "..."}
  },
  "plan_rationale": "Only calculate() logic changes; ...",
  "open_questions": [],
  "analytics_run_token": "...",
  "git_enabled": true,
  "git_disabled_reason": "",
  "branch": "my-lex-app/edit-01-fix-rounding-in-produ",
  "base_branch": "main",
  "run_number": 1,
  "commits": [{"task_id": "lex-calculation-change", "sha": "8f21c0d...",
               "message": "[edit/lex-calculation-change] Round to 2 decimals"}],
  "remote": "acme/my-lex-app",
  "pull_request": null
}
```

Artifacts live under `edits/<run_id>/`, and unlike the manifest they are
committed.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Edit session not initialized. Call kickstart_edit() first." | No run is open in this server. `kickstart_edit(...)` opens one — and after a restart, restores this checkout's unfinished run from its manifest. |
| "No edit plan committed yet. Call set_edit_plan() first." | Call `list_edit_tasks()`, then `set_edit_plan(...)`. |
| "These ids are sustainability tasks" (in `set_edit_plan`) | Only pass code-change ids; sustainability ones are injected. |
| "Task X is not in the committed plan" | Server rejects unknown task ids. Re-run `set_edit_plan` if you need to expand scope. |
| "N planned task(s) still pending" (in `finalize_edit`) | Complete or waive them first. |
| "rationale must be at least 10/20 characters" | Provide a real explanation. |
| "Task '...' is recorded but its commit failed: ..." | Only the commit is missing; the record is saved. Fix the git problem in the project and re-call `notify_task_complete(...)` with the same arguments. |
| "Could not create the edit branch '...'" or "Could not checkpoint the uncommitted changes already in this checkout" | Resolve it in the project — commit or stash the loose work, confirm the base branch exists — then call `kickstart_edit(...)` again. |
| `finalize_edit` returns `ok: true` but `publication.skipped` is set | The branch and its commits are complete locally; the push or the pull request did not happen (no GitHub token, no GitHub remote, or the push itself failed). Tell the user exactly that, in those words. |

---

## Sanity checklist before finalizing

- Every code-change task has an artifact (`task-<task_id>.md`) under `edits/<run_id>/`.
- Compliance verdict is PASS or PARTIAL (not FAIL).
- Migration report says `NO_MIGRATION_NEEDED` or `MIGRATION_CREATED`.
- Waivers each have a rationale in the run's manifest.
- Each resolved task in `get_edit_status()` shows a `commit`, or you can say why
  it does not — a task that changed no files commits nothing, and that is
  recorded rather than faked.
- `git.enabled` is `true`, or its `reason` states why this project has no
  version control.
- You have run no git commands of your own.

## Stale Tool-List Recovery

If a tool call returns `ok: false` with `stale_tool_call: true`, your tool list
is out-of-sync with the active mode.

Follow this sequence:

1. Surface the troubleshooting block to the user.
2. Force a tool list refresh.
3. If `suggested_mode` is provided, switch via `switch_to_mode(target_mode="...")`.
4. Retry the original tool call only after refresh/switch completes.

Do not continue planning or task execution against a stale tool surface.

---

*Instructions for edit MCP in Lex framework. Last updated: August 18, 2026.*

## Reading a data file — delegate it, never read it yourself

The user's input data arrives as whatever they have: `.csv`, `.tsv`, `.xlsx`,
`.xlsm`, `.xls` or `.pdf`. No format is privileged.

**Invoke the `lex-spreadsheet-reader` sub-agent, one invocation per file.** It
returns a short report: the sheet inventory, the verbatim column names, observed
types, number formats, and the structural traps that silently break a parser —
merged headers, formulas with no cached value, percentages stored as fractions,
totals rows, hidden sheets.

Delegate rather than read because the numbers are brutal. A 100k-row workbook is
around six million characters; pulling that through your own context costs you
the room you needed for the actual work, and the sub-agent hands you back about
eighty lines instead.

- Build your schema from the report, and carry its `sha256` so the schema cites
  an exact file version.
- Treat its "Open questions" list as questions **for the user** — whether a
  column is always populated, the full set of allowed values, whether a key is
  unique. Ask; do not guess.
**For a PDF, invoke `lex-document-reader` instead.** PDFs do not yield to the
same treatment: a scan or a chart has no text to extract, so the sub-agent looks
at rendered page images itself and reports what it found. Two things from its
report matter to you:

- Figures it marks `transcribed (unverified)` were read off pixels. Never record
  one as an exact number without the user confirming it, and never let one become
  a column type, an allowed value, or a test's expected value.
- Its "Verdict for ingestion" is a project decision, not a detail. A PDF with no
  text layer **cannot be parsed by the app** — a Lex upload parser is pandas
  code, and pandas has no PDF reader. Put the choice to the user: a
  machine-readable export, or extraction scoped as real work with its own
  accuracy criteria. Do not let a successful read imply the problem is solved.

The sub-agent has `lex-mcp-local/read_input_file` for this, so it works with no
terminal. Never write a throwaway pandas script and read a schema back out of
stdout: that truncates, it fails silently where there is no shell, and it puts
the whole file in context when you only needed its shape.


## When you cannot know something: ask, do not guess

You are the only actor here who can talk to the user. A sub-agent that hits
something it cannot know returns the question to you, and if you do not put it to
the user it becomes a guess with nobody's name on it.

`lex-mcp-local/ask_user_question` puts one question to them. Where the host can
render a dialog the answer comes back inside that same call and is recorded as
their own words; where it cannot, you get a form link and a question to relay,
and you close it with `lex-mcp-local/record_user_answer`. Ask one decision per
call, offer two to four options that each state their own consequence, and put
your recommendation first.

Ask **at the moment it comes up**, not at the end. A question saved for the final
report is answered after the work is finished, when acting on it costs a rewrite
— which is exactly why it then gets ignored. And carry every answer into the next
brief: each agent starts with an empty context, so an answer left in this
conversation is one the next agent will re-guess differently.

If the user will not or cannot answer, say so honestly with
`record_user_answer(declined=true, assumption='<what you will assume>')`. A
disclosed gap is a fact. A silent default is a claim nobody made.

Never pass your own inference as though the user said it, and never raise a
permission or an authority level by default. Your host loads the full doctrine as
a rule alongside these instructions.

## When the request belongs to another mode

Brief mode is LEX's front door. It interviews the user about what they want,
writes `.lex/contract.md`, and switches to the mode that work needs — so a
request that does not belong to this mode goes back through it rather than being
attempted here or refused.

If what the user now wants is a different kind of run — build new, change
existing, document, audit, test, adapt to changed input data, deploy — and you
cannot tell which, or they have not stated the requirements it would need:

```
switch_to_mode(target_mode="brief", confirm_mode_switch=true,
               user_request="<their words>")
```

Then follow the instructions that arrive with the new surface. Do not try to call
brief's tools from here: they are not on this mode's surface until the switch
completes, and the tool list has to refresh first.

When they *have* already said plainly which mode they want, switch straight to it
instead. Brief exists to settle an open question, not to be a toll booth on a
clear one.

Either way the switch is the user's decision: quote their own words in
`user_request` and never synthesise it.

## Agent delegation protocol (no native subagents here)

This environment has no named subagents, so the Lex agents ship as instruction
files under `.lex/agents/` instead. The delegation contract is unchanged — only
the spawning mechanism differs.

This mode is **flat**: there is no numbered step loop and no
`get_plan_step` / `notify_step_complete` pair. The Lex MCP tool surface for
`edit` mode tells you which agent to invoke and when; read its tool
descriptions and the workspace rules below for the actual call sequence.

For every unit of work the MCP hands you:

1. Fetch the brief from the Lex MCP tool that owns it.
2. Read `.lex/agents/<agent-name>.md` — the agent named in that brief — **in
   full**.
3. Execute that file as a single focused sub-task, with the brief as its input.
   Treat it as your complete instruction set: do only what it says, and do all
   of it.
4. Drop the agent's working detail from your active reasoning before moving on,
   keeping only the summary the MCP needs back. This is the whole point of the
   protocol — the later units of work must not run in a context clogged with
   the earlier ones' detail.
5. Report that summary back through the matching Lex MCP tool.

Rules that still apply exactly as written:

- You are the **coordinator**. The agent files are workers. An agent file never
  calls the Lex MCP tools — you do.
- Do not do an agent's work inline because it looks small. The isolation is
  what keeps the run's later stages sharp.
- If any Lex MCP tool returns `ok: false`, **halt** and surface the error. Do
  not improvise a recovery.
- Git operations are hands-off unless the mode's own rules say otherwise.

| Step agent | Purpose | Instruction file |
| --- | --- | --- |
| `lex-docs-reader` | Lex docs reader — use when: need to check framework rules, read lex conventions, look up handbook patterns, check naming conventions, und... | `.lex/agents/lex-docs-reader.md` |
| `lex-document-reader` | Lex document reader — use when: a PDF was provided, read a scanned document, what does this PDF contain, is this PDF machine-readable | `.lex/agents/lex-document-reader.md` |
| `lex-edit-compliance` | Verify Lex framework compliance on the files a code-change task just modified. Non-waivable sustainability task. Use when task id is 'lex... | `.lex/agents/lex-edit-compliance.md` |
| `lex-edit-dependent-scan` | Dependent code scanner — use when: verifying that other modules importing / calling / subclassing the changed symbols still work after th... | `.lex/agents/lex-edit-dependent-scan.md` |
| `lex-edit-docs-sync` | Sync docs/ and README with a code change so documentation does not go stale. Waivable sustainability task. Use when task id is 'docs-sync'. | `.lex/agents/lex-edit-docs-sync.md` |
| `lex-edit-generic-implementer` | Implement a small, non-Lex-framework code change (utilities, glue, third-party integration, plain Python). Use when the orchestrator's ta... | `.lex/agents/lex-edit-generic-implementer.md` |
| `lex-edit-lex-implementer` | Implement a focused Lex-framework code change (models, calculations, hooks, permissions, serializers, signals, celery, streamlit, fields,... | `.lex/agents/lex-edit-lex-implementer.md` |
| `lex-edit-migration` | Django migration agent — use when: a LexModel / CalculatedModelMixin / lifecycle-hook / fields-report code-change task was planned and Dj... | `.lex/agents/lex-edit-migration.md` |
| `lex-edit-technical-map-sync` | Update the technical-map wiki and per-module CONTEXT.md files for modules whose public surface changed. Waivable sustainability task. Use... | `.lex/agents/lex-edit-technical-map-sync.md` |
| `lex-edit-tests` | Tests agent — use when: adding or updating unit/integration tests for the code that was just changed. Waivable only when the change is pu... | `.lex/agents/lex-edit-tests.md` |
| `lex-spreadsheet-reader` | Lex spreadsheet agent — use when: a spreadsheet is the input or output, inspect a workbook, document a schema, create or edit an xlsx | `.lex/agents/lex-spreadsheet-reader.md` |
| `lex-validator` | Lex code validator — use when: validate step output, check lex compliance, verify implementation against specifications, review before co... | `.lex/agents/lex-validator.md` |


## Scoped rule: lex questions

_Use when: you hit something you cannot know and a wrong guess would change what you build — a requirement that reads two ways, an expected value with no source outside the app, a business rule the code does not state, evidence that could mean either a defect or your own mistake. Covers when an interruption is earned, how to shape a question the user can answer cold, and why a question filed into a report is not a question._

# Asking the user

You can now build far more than you have been told. That is the whole problem: the
dominant failure is no longer bad code, it is correct code for the wrong
requirement. A question is the only instrument that closes that gap, and a badly
shaped question closes nothing while still spending the user's attention.

Two things follow. Asking is part of the work, not a confession that you are
stuck. And an interruption has to be earned, because a user who learns your
questions are noise stops reading them — and then the one that mattered arrives
too late.

**Ask with `ask_user_question`.** Where the host can render a dialog, the answer
comes back inside that same call and is recorded as the user's own words. Where it
cannot, you get a form link and a question to relay, and you close it with
`record_user_answer`. What you must not do is write the question into a report
instead. That report is read after the work is finished, when acting on the answer
costs a rewrite — which is why nobody wants it by then. A question in an artefact
is a note. Only a question put to the user is a question.

## When to ask

Three gates. A question needs all three.

| Gate | Test |
| --- | --- |
| **Material** | A different answer produces a different artefact |
| **Unavailable** | It is not in the requirements, `docs/lex_topics/`, `.lex/contract.md`, the project's own code, or a file you were given |
| **Timely** | The answer changes work not yet done |

Fails **material** — take the sensible reading and record which one you took.
Fails **unavailable** — go read. The reader sub-agents exist so you never have to
ask what is discoverable.
Fails **timely** — you are already holding a rewrite. Say so, then ask anyway.

**The asymmetry override.** Materiality can be low and you should still ask when
being wrong is expensive to undo: anything that grants a permission, deletes or
overwrites data, or sets a default that everything later inherits.

**Always ask, regardless of the gates, for these four.** They are the ones this
system is built to refuse to guess:

1. **An expected value with no source outside the app.** There is no acceptable
   default. A number read off a run can only fail if the app becomes
   non-deterministic, which is not a test and not a check. Ask for the workbook
   or the figure; if there is none, the thing it would have proven is uncovered.
2. **A requirement that reads two ways.** Pick one and half the work built on it
   is solving a problem nobody has.
3. **Evidence that could mean either a defect or your own mistake.** Getting this
   backwards either hides a real bug or files a false one against the user's
   application. Show them the evidence and let them say which it is.
4. **Behaviour that appears in no requirement.** Whether it matters is a product
   question, and it is not yours to settle.

## How to shape it

- **One decision per question.** If it contains "and", it is two questions, and
  you will get an answer that resolves neither.
- **Ask about the instance, not the abstraction.** Not "how should rounding be
  handled" but "AC-014 says the total is 1,204.50; the app produces 1,204.4972.
  Is the criterion rounded to two places, or is that a defect?"
- **Put the consequence in the option.** The user picks by what it costs them.
  "No workbook available" means nothing; "No workbook, so AC-014 is reported
  uncovered and no assertion is written for it" means something.
- **Recommend one and say why.** You have read the code and the requirements; the
  user has not. Handing back an unranked menu wastes the reading.
- **Two to four options, and leave the unknown escape on.** "I don't know yet" is
  a legitimate answer and a recorded fact. A guess dressed as an answer is not.
- **Never ask a question whose answer you would override.** If one branch is
  unacceptable, that is a finding to state, not an option to offer.
- **Batch only what is independent.** A question whose right form depends on the
  previous answer waits its turn.

## Who asks

**Only the coordinator talks to the user.** The specialist agents run as
sub-agents and have no conversation to interrupt.

So the protocol is:

1. An agent that hits a blocking unknown **stops on it** rather than guessing,
   and returns it at the top of its summary, with the two or three answers it
   could take and what each one costs.
2. The coordinator records it on the completion call and puts it to the user
   **before starting the next piece of work**, not at the end.
3. The answer goes into the artefact and into the brief for everything later.

Step 3 is the one that gets skipped. Every agent here starts with an empty
context by design, so the brief is the only channel between them: an answer left
in the conversation is gone the moment the next agent starts, and that agent will
guess differently.

## What an unanswered question becomes

The user is allowed to decline, and to stop being asked. Take that the first time.

- Close it with `record_user_answer(declined=true, assumption='...')` so the
  assumption is recorded rather than left implicit.
- Record it as a **named gap** in the artefact, carrying that assumption.
- **Never resolve a permission or an authority level upward by default.** A
  permission nobody granted is not a permission.
- A gap disclosed is a fact. A gap silently defaulted is a claim nobody made, and
  the code becomes its only record.

## Anti-patterns

| Pattern | Why it fails |
| --- | --- |
| The report question | Filed where nobody answers it. This is the default outcome and it is what this file exists to stop |
| The end-of-run dump | Twelve questions surfaced at the finish, when every answer costs a rewrite |
| The mega-list | Six numbered questions in one message. One and a half get answered |
| The permission fish | "Shall I continue?" — no decision content, so no answer is wrong |
| The unread source | Asking what the requirements already state |
| The accepted shrug | Recording "standard" or "whatever you think" as an answer. Those are refusals; come back with something concrete |
| The lost answer | A good answer left in the chat instead of in the brief, so the next agent re-guesses it |
| The laundered guess | Passing your own inference to `record_user_answer` as though the user said it. The one unforgivable error here, because every later decision then treats it as settled |

<!-- END LEX MCP MANAGED BLOCK -->
