# Lex MCP Local - Execution Model

This document describes how the current Lex MCP server executes work in a
downstream Lex project. It replaces the older forward-only 0-14 step model.

## Current Shape

`lex-mcp` is a unified FastMCP server. It imports ten independent mode
surfaces and exposes exactly one surface to the IDE assistant at a time.

| Mode | Execution style | Main purpose |
| --- | --- | --- |
| `brief` | Flat question cursor | **Default.** Interview the user, write `.lex/contract.md`, route to the mode that does the work |
| `forward` | Coordinator-agent loop | Build a full new Lex App through steps 0-19 |
| `backward` | Coordinator-agent loop | Reverse-document an existing project |
| `edit` | Flat task-catalog run | Make targeted changes to an existing Lex app |
| `review` | Flat review run | Produce audit/review reports |
| `test` | Flat responsibility run | Write the test suite and prove it catches regressions |
| `input` | Flat change-area run | Adapt an existing Lex app to a changed input-data format |
| `deploy` | Sequential handbook run | Get an existing Lex app running in a target environment |
| `mvp_generator` | Checkpoint-gated flat run | Generate a constrained MVP |
| `mvp_completion` | Coordinator-agent loop | Expand an MVP into full-product scope |

The coordinator is the IDE LLM. The coordinator calls MCP tools, receives the
next brief, invokes the named downstream agent, and reports completion back to
the MCP. The coordinator must not do step or task work itself when the MCP has
returned a specific agent to run.

## Universal Execution Rules

These rules apply to every mode.

1. Select the correct mode before starting work. Use `docs/mcp-modes.md` for
   the quick mode picker. `brief` is the default: when the user's intent does not
   plainly match one mode, start there and let the interview route.
2. The first mode-specific action is always the mode's kickstart tool:
   `kickstart_brief`, `kickstart_workflow`, `kickstart_run`, `reverse_kickstart`,
   `kickstart_edit`, `kickstart_review`, `kickstart_test_run`,
   `kickstart_input_change`, `kickstart_deployment`, or `kickstart_mvp`. Every one
   of them except `kickstart_brief` accepts a `contract_path`, and finds
   `.lex/contract.md` on its own when the argument is omitted — so a run that came
   through `brief` is grounded in what the user already agreed to. Read that
   contract before re-asking anything it settles.
3. When a tool returns a brief with an agent name, invoke that agent as the
   worker and keep the coordinator focused on orchestration.
4. When any MCP tool returns `ok: false`, stop immediately, show the
   troubleshooting payload to the user, wait for the user to resolve the
   issue, then retry the same tool.
5. Do not switch modes to bypass an error. Switch only when the user intent
   genuinely changes or a stale-tool payload tells you the requested tool
   belongs to another mode.
6. **Keep the mode's markdown reports describing the run as it now stands.**
   The reports directory is where the user follows the work: they open those
   files to see what is planned, what is done, and what was found. A report that
   has gone out of date is worse than a missing one, because a missing file
   prompts a question and a stale file is simply believed. So when a later step
   or responsibility changes something an earlier report asserted -- a scope
   that grew, a decision that was reversed, a count that moved -- refresh that
   report before you move on, and say in it what changed.

   Two things this rule is not. It does not apply to an artifact the server
   renders itself, such as a consolidated `*-REPORT.md` or an `_index.md`: those
   are rebuilt from live state on every write and cannot fall behind. And it is
   not discharged by a tool that records the same facts in machine-readable
   form -- a `.json` beside the reports exists so the *server* can grade the
   run, and writing one leaves the user's copy of those facts untouched.

## Mode Routing

Use user intent first; tool names are secondary.

| User intent | Correct mode |
| --- | --- |
| Anything vague, or spanning more than one row below | `brief` |
| Plan, specify, or work out what is needed | `brief` |
| Build a new Lex app from scratch | `forward` |
| Build only an MVP quickly | `mvp_generator` |
| Finish, expand, or complete an MVP to full product | `mvp_completion` |
| Modify or add a feature to an existing Lex app | `edit` |
| Review or audit an existing project | `review` |
| Write tests, test data, or audit test effectiveness | `test` |
| Adapt an existing Lex app to a changed input-data format | `input` |
| Get an existing app running on local, staging, or production | `deploy` |
| Document or reverse-document existing code | `backward` |

Priority rules:

1. "MVP" plus "complete", "finish", "expand", or "full product" means
   `mvp_completion`.
2. "MVP" plus initial creation means `mvp_generator`.
3. Existing-project implementation changes without MVP-completion wording mean
   `edit`.
4. Never use `edit` for MVP completion.
5. Requests for tests, test data, or test coverage mean `test`, not `edit`.
6. Input-format-migration requests ("the input format changed", "the columns
   are different now", "new CSV layout", "the upload file broke") mean
   `input`, not `edit`. `edit` is for feature or behavior changes; `review`
   is a read-only audit.
7. Requests to run the app *somewhere* -- a server, a container, staging,
   production -- mean `deploy`, not `forward` or `edit`. Deploy mode configures
   and runs; it writes no application code.
8. When intent matches multiple rows, or none plainly, use `brief`. Its first
   question asks which kind of run this is and offers one option per mode, so the
   clarification happens on the record — with a question id, a provenance tag, and
   a place in the contract — rather than in chat where nothing keeps it.

## Unified Runner and Mode Switching

The recommended entry point is the unified `lex-mcp` process. Boot mode is
resolved in this order:

1. CLI `--mode`.
2. One-shot override file at `~/.lex-mcp/mode-override`.
3. Nearby `mcp.json` launch arguments.
4. Default `brief` — a boot with nothing to go on is a user who has not chosen,
   and the interview is the mode that asks.

`LEX_MCP_MODE` is passive reflection, not authoritative input. The server
rewrites it to match the actual running mode.

In unified mode, `switch_to_mode(target_mode=...)` delegates to
`mode_switch.live_switch_mode(...)`, which swaps the mounted FastMCP provider,
updates external state, bumps the tool-surface epoch, and sends
`notifications/tools/list_changed` so the IDE refreshes its tool list.

Every surface installs stale-tool middleware. If an IDE calls a tool from a
previous mode, the server returns a structured payload with
`stale_tool_call: true`, the active mode, an optional suggested mode, the
current `tool_surface_epoch`, and refresh/retry guidance.

## Forward Mode

Use `forward` for full new-product creation.

```text
/lex-app "..."                         # user prompt
kickstart_workflow(...)                # new GitHub repo and first run branch
  OR
kickstart_run(...)                     # new run branch on existing GitHub repo

for step N in 0..19:
  get_plan_step(step=N)
  runSubagent("lex-step-NN", brief)
  notify_step_complete(step=N, process, summary)

finalize_workflow()                    # stage 1: audit-report instructions
write plans/technical_docs/audit-report.md
finalize_workflow(audit_complete=True) # stage 2: PR, squash merge, issue close
```

Forward phases:

| Phase | Steps | Purpose |
| --- | --- | --- |
| Planning | 0-8 | Overview, IO, requirements, story, architecture, functions, diagrams, pseudocode, compliance |
| Implementation | 9-11 | Implementation plan, blueprint, code delivery |
| Hardening | 12-14 | Initial data, Streamlit/dashboard work, Lex compliance |
| Wiki | 15-18 | AST scaffold and technical-map enrichment |
| Sync | 19 | Forward/backward doc and code reconciliation |

`get_plan_step` detects user changes between steps. Tracked changes to files
owned by completed steps can force re-execution from the earliest affected
step. New `.csv`, `.xlsx`, or `.xls` files force re-execution from the IO
step. Other new untracked files are noted but do not force re-execution by
themselves.

Forward-style modes commit and push after each `notify_step_complete` call, and
`edit` does the same after each `notify_task_complete`. Wherever the server owns
git, it is the only writer on the run's branch: the coordinator and its agents
must not run git commands themselves, because a hand-run commit, checkout, or
push puts work in the wrong commit or on the wrong branch.

## Backward Mode

Use `backward` to reverse-document an existing project.

```text
/lex-reverse "<path or GitHub URL>"
reverse_kickstart(project_path=... OR github_url=...)
scan_project()
generate_wiki()

for step N in 3..6:
  get_reverse_step(step=N)
  runSubagent("lex-reverse-step-NN", brief)
  notify_reverse_complete(step=N, summary)

generate_questionnaire()
PAUSE while the user fills discovery-questionnaire.md
submit_questionnaire(path=...)

for step N in 8..16:
  get_reverse_step(step=N)
  runSubagent("lex-reverse-step-NN", brief)
  notify_reverse_complete(step=N, summary)

finalize_reverse()
runSubagent("lex-reverse-step-17", gap-report brief)
notify_reverse_complete(step=17, summary)
```

Backward mode may clone a GitHub URL for inspection, but it does not commit,
push, create branches, open PRs, or merge. Outputs land in the downstream
project's docs and technical-map folders.

## Edit Mode

Use `edit` for focused implementation changes to an existing Lex app.

```text
/lex-edit
kickstart_edit(project_path, change_description, context="")
                                        # checkpoints any uncommitted work, then
                                        # cuts <project>/edit-NN-<change-slug>
list_edit_tasks(category?)              # optional
propose_edit_plan(change_description)   # optional helper
set_edit_plan(task_ids=[...], rationale="...")

for each task in the final plan:
  get_task_brief(task_id)
  runSubagent(brief.agent, brief)
  notify_task_complete(task_id, summary, artifacts=[...])
                                        # commits "[edit/<task_id>] <summary>"
  OR waive_task(task_id, rationale)      # waivable sustainability tasks only;
                                         # makes no commit

finalize_edit()                         # EDIT-REPORT.md, push, open a PR; no merge
```

Edit mode is task-catalog driven, not stage driven. The coordinator chooses
the smallest useful set of atomic code-change tasks. The server auto-injects
sustainability tasks such as Lex compliance, dependent-code scan, tests,
docs sync, technical-map sync, and migration checks. `lex-compliance-check`
is non-waivable. `migration-check` is non-waivable when a model-shaped change
requires it.

Edit mode owns git for the run. `kickstart_edit` first commits whatever was
already uncommitted in the checkout — on the branch the user was on, as
`chore: checkpoint work in progress before a lex edit run` — so that the user's
own work is theirs and not swept into a task commit. It then cuts
`<project-slug>/edit-NN-<change-slug>` from the base branch.
`notify_task_complete` commits that task's work as its own commit, with the
summary you pass as the commit subject, so the code change, the dependent-code
fixes, the tests and the docs each land separately and a reviewer can tell which
change a file belongs to. `waive_task` makes no commit. `finalize_edit` writes
`EDIT-REPORT.md`, commits it, pushes the branch, and opens a pull request against
the base branch.

It stops at the pull request and does not merge. Several edit runs can be open on
one base branch at a time, so merging one while another is still building on that
same base is a person's decision, not the server's.

Commits exclude `.lex-edit/`, the run's own session state, which holds the
question ledger. They include `edits/<run_id>/`, which is deliberately tracked, so
the report and every task artifact travel with the branch and are visible in the
pull request. A project that is not a git repository still runs: the session
records `git.enabled: false` with a reason and commits nothing.

The server is the only writer on the branch. Neither the coordinator nor a task
agent should run git.

### Two Edit Runs At Once

Every run has its own branch, its own manifest at
`.lex-edit/runs/<run_id>.json`, and its own `edits/<run_id>/` directory. The run
id *is* the branch: a run on `my-lex-app/edit-01-fix-rounding` has the id
`edit-01-fix-rounding`. Git already refuses two branches with one name, so no two
runs can share an id, and any checkout can tell you which run it is in with
`git rev-parse --abbrev-ref HEAD`. A project that is not a git repository has no
branch to be named after and falls back to a timestamped id.

Runs are also recorded in a registry inside the repository's git common
directory, which every worktree of that repository shares. That is what agrees
the base branch: the first active run's base is handed to every run that starts
while it is still open, which makes the diffs compose instead of stacking one
run's work under another's.

One checkout holds one run. A second `kickstart_edit` in a checkout that already
has an active run returns `ok: false` with `action_required: "move_to_worktree"`.
The server has already created the worktree and seeded it by then; the payload
carries `worktree_path`, `worktree_branch`, `worktree_base`, `seeded_files`,
`blocking_run`, and `worktree_guidance`. Move to `worktree_path` and call
`kickstart_edit` again with that directory as `project_path` — it resumes this run
rather than opening a third.

Seeding is why the server makes the worktree instead of leaving it to the host. A
git worktree is a checkout of *tracked* files, and `.env` plus every
project-scoped MCP config are deliberately untracked because they carry
`GITHUB_TOKEN`. An unseeded worktree therefore has no lex MCP server in it at all,
and the agent sent there to work in isolation arrives to no tools. The server
copies those files across and writes a `.worktreeinclude` so the host's own
worktree feature carries the same set.

`worktree_guidance` names the affordance for each environment the project
onboarded. Six of the seven have one natively:

| Environment | How a second isolated session starts |
| --- | --- |
| Copilot in JetBrains | "Worktree isolation" — offered by the Copilot CLI agent harness only |
| VS Code Copilot | "New Worktree" — Agent Host sessions only |
| Copilot CLI | `copilot --worktree <name>` / `-w`, or `/worktree` in session |
| Cursor | `/worktree`, or `cursor -w <name>` |
| Claude Code | `claude --worktree <name>` / `-w`, the `EnterWorktree` tool, and a worktree per session in Desktop |
| Windsurf | "Worktree mode" — set on the Cascade input before the conversation starts |

Codex does not. Worktrees exist there only in the ChatGPT desktop app, which is
not the `.codex/config.toml` surface lex registers into, so a Codex user runs
`git worktree add <path> -b <branch>` themselves and starts a second `codex` in
that directory.

When more than one run is open in one server, say which one a call is for:
`propose_edit_plan`, `set_edit_plan`, `get_task_brief`, `notify_task_complete`,
`waive_task`, `get_edit_status`, and `finalize_edit` all take an optional
`run_id`. It is only needed then — with a single open run it is omitted, and with
two open and no `run_id` the call returns `ok: false` naming the candidates rather
than guessing. `get_edit_status()` with no `run_id` lists every run with its id,
branch, project root, change, and progress; that is how a coordinator finds the id
it was asked for.

`ask_user_question` and `record_user_answer` take `run_id` on the same terms.
Each run keeps its own question ledger, so ids never collide between runs and a
question raised in one is invisible to the other. Asking needs the `run_id` when
two runs are open, because a new question has no id to resolve by; recording an
answer does not, because the question id already belongs to exactly one run.

## Review Mode

Use `review` for static audits.

```text
/lex-review "<path or GitHub URL>"
kickstart_review(project_path=... OR github_url=...)
list_review_types()                     # optional

for each requested review type:
  get_review_brief(review_type="convention"|"business", ...)
  runSubagent("lex-review-...", brief)
  notify_review_complete(review_type, summary, artifacts, findings_count, severity)

finalize_review()
```

Review mode is intentionally flat. After `kickstart_review`, every tool is
optional and `finalize_review` is idempotent. Built-in review types are
`convention` and `business`. Reports land under `reviews/`; the MCP does not
commit them.

## Test Mode

Use `test` to write the test suite for an existing Lex app and prove it works.

```text
/lex-test "<path or GitHub URL>"
kickstart_test_run(project_path=... OR github_url=..., focus=...)

  if prerequisite_blocked:
    dispatch_reverse_prerequisite(confirm_switch=True, user_request="...")
    -> run the backward workflow to completion
    -> switch_to_mode(target_mode="test", ...)
    -> kickstart_test_run(...)            # resumes from the manifest

list_responsibilities()
propose_test_plan()
set_test_plan(responsibilities=[...], rationale="...")

for each planned responsibility:
  get_responsibility_brief(responsibility="...")
  runSubagent("lex-test-...", brief)
  notify_responsibility_complete(responsibility, summary, artifacts, ...)

record_scenario_matrix(scenarios=[...])   # after the scenario designer
record_test_execution(command, passed, failed, errors, skipped, ...)  # after the runner
finalize_test_run()
```

Test mode is flat and autonomous: the orchestrator is handed every
responsibility and picks the ones the project needs. Two things are enforced.

**Entry gate.** The project must already carry LEX-AI-style user stories
(`plans/technical_docs/step-03-user-stories.md` or
`plans/business_docs/business/03-user-journeys.md`). Every assertion has to
trace back to a stated acceptance criterion, so `kickstart_test_run` returns
`ok: false` with `prerequisite_blocked` when they are absent and
`dispatch_reverse_prerequisite` runs the backward workflow first. User stories
are never invented to pass this gate.

**Exit gate.** `finalize_test_run` refuses a clean report while a mandatory
responsibility is outstanding, the scenario matrix is unrecorded, the suite was
never executed, or an acceptance criterion has no effectiveness-proven
scenario. `incomplete_rationale` produces an explicitly INCOMPLETE report
instead of bypassing the gate.

Five responsibilities are mandatory and cannot be waived: `story-assurance`,
`scenario-matrix`, `execution`, `effectiveness-audit`, `gap-report`. The
optional ones are `chain-authoring`, `assertion-authoring`,
`calculation-coverage`, `runner-config`, and `chain-fidelity-audit`.

Tests and JSON scenario data land under `Tests/`; reports land under
`test-runs/`. The MCP does not commit them.

## Input Mode

Use `input` when the input-data format of an existing Lex app changed and the
app must be adapted: renamed, added, or dropped columns, a new delimiter or
encoding, a new row grain, or restructured upload files. A Lex App's input
parsing is hand-written pandas code inside upload models' `calculate()`
methods, so a format change is a code migration.

```text
/lex-input "<what changed>"
kickstart_input_change(project_path=...)
register_format_change(...)              # once per changed input file
get_intake_brief()
runSubagent("lex-input-analyst", brief)  # sniffs sample file or interviews the user

for each impacted change area:
  get_change_brief(area="...")
  runSubagent("lex-input-<area>", brief)
  notify_change_complete(area, summary, artifacts=[...])

get_input_change_status()                # optional
finalize_input_change()
```

Input mode is flat like `review` and `edit`: `kickstart_input_change` is the
only mandatory first call and there is no mandatory ordering afterwards.
Intake is dual-path. The user either provides a sample file in the new format
(CSV/TSV headers are sniffed server-side with stdlib csv; XLSX is inspected by
the analyst agent) or describes the change verbally, in which case
`lex-input-analyst` interviews the user until the old-vs-new column mapping is
unambiguous. The analyst writes `input-changes/format-spec-<run-id>.md` and
recommends impacted areas.

Seven change areas each map to a dedicated agent: `upload-parser`
(`lex-input-parser`), `data-model` (`lex-input-model`), `migrations`
(`lex-input-migration`), `calc-fanout` (`lex-input-calc`), `reports`
(`lex-input-reports`), `serializers` (`lex-input-serializers`), and
`test-data` (`lex-input-tests`). Shared sub-agents are `lex-validator` and
`lex-docs-reader`.

Outputs land under `input-changes/` (format spec, per-area change logs,
`_index.md`, and `INPUT-FORMAT-CHANGE-REPORT.md` written by finalize). Session state
lives in `.lex-input/manifest.json`. `finalize_input_change` warns when the
recommended areas (`upload-parser`, `migrations`, `test-data`) never
completed.

## Deployment Mode

Use `deploy` when a Lex App that already exists has to run somewhere.

```text
/lex-deploy
kickstart_deployment(project_path=..., deployment_target="local"|"staging"|"production")

for each step the handbook returns:
  get_deployment_step(step=N)
  runSubagent("lex-deploy-step", step body + target + notes + deploy_scan)
  notify_deployment_step_complete(step=N, summary, artifacts=[...],
                                  commands_run=[...], status=...)

runSubagent("lex-deploy-verifier", "prove it actually runs")
get_deployment_status()                 # optional
finalize_deployment()
```

Deploy is sequential like `forward`: the step bodies come from the Lex
deployment handbook on the remote MCP and are run in order. Unlike `forward` and
`edit` there is no git -- the server never commits or pushes, because a
deployment run touches credentials and infrastructure config.

`kickstart_deployment` returns a `deploy_scan`: the compose files, Dockerfiles,
env templates, migration directories, and CI workflows the project already has.
Read it before asking the user anything, and pass it to every step agent, which
starts with an empty context.

Two rules are load-bearing.

**Secrets never become artifacts.** No step summary, note, index row, or report
may contain a credential value -- only the key name and where it belongs. The
user sets values themselves. A secret found already committed to the repository
is a halt, not a finding.

**A blocked step is not a finished step.** Deployments stall on things only the
user can supply: a DNS record, a firewall rule, a credential, an approval.
Record the step `blocked` or `partial` with a summary naming exactly what is
missing; `notify_deployment_step_complete` then points back at that same step
rather than the next one, and a re-run replaces the record instead of appending
a second one. `finalize_deployment` returns every blocked and partial step so a
stalled run is never reported as done.

Outputs land under `deployment/` (per-step notes, `_index.md`, and
`DEPLOYMENT-REPORT.md` written by finalize). Session state lives in
`.lex-deploy/manifest.json`.

Deployment was previously a second "process" inside forward mode, reachable
only through an unadvertised `get_deployment_step` tool at the tail of a
greenfield build. `forward` and `mvp_completion` no longer accept
`process="deployment"`.

## MVP Generator Mode

Use `mvp_generator` for a constrained first version.

```text
/lex-mvp
kickstart_mvp(project_path, problem_statement, project_name?, resume=False)
list_mvp_checkpoints()                  # optional
submit_mvp_plan(plan={...})
submit_mvp_scope(entities=[...], requirements=[...], rationale="...")
scaffold_mvp()
runSubagent("lex-mvp-implementer", scaffold_manifest + scope)
record_implementation(files_written, notes="")
run_boot_checklist()
  if blocking:
    runSubagent("lex-mvp-verifier", checklist_result)
    runSubagent("lex-mvp-implementer", verifier_report)
    run_boot_checklist()
finalize_mvp()
```

Current MVP caps:

| Cap | Value |
| --- | --- |
| Requirements | 10 max, 240 characters each |
| Entities | 5 max |
| Fields per entity | 8 max |
| Demo walkthrough | At least 3 steps in `submit_mvp_plan` |
| Calculations | Dumb-but-real calculations; no numeric cap in the current code |

`scaffold_mvp` writes a deterministic skeleton including `Inputs/`,
`Uploads/`, `Reports/`, `demo/`, `tests/`, `model_structure.yaml`,
`lex_config.py`, `requirements.txt`, and `README.md`. `finalize_mvp` is gated
by `run_boot_checklist` and refuses to close while critical boot-contract
checks fail. MVP mode uses local git checkpoints when git is available, but it
does not push to a remote.

## MVP Completion Mode

Use `mvp_completion` when an MVP already exists and the user asks to complete,
finish, expand, or upgrade it to full-product scope.

```text
kickstart_run(...)                      # existing MVP project

for step N in 9..19:
  get_plan_step(step=N)
  runSubagent("lex-step-NN" or "lex-step-11-refactor", brief)
  notify_step_complete(step=N, process, summary)

finalize_workflow()
write plans/technical_docs/audit-report.md
finalize_workflow(audit_complete=True)
```

Completion mode assumes the planning artefacts for steps 0-8 already exist
under `plans/technical_docs/`. An MVP run does not create them — it writes
`mvp/<run_id>/` — so coming from an MVP those documents have to be written by
hand first.
It uses the same forward-style Git/GitHub machinery and starts meaningful work
at step 9. Step 11 can route to `lex-step-11-refactor` when existing code must
be reconciled instead of created from scratch.

## Agents and Payload

Onboarding installs one mode's agents into **this project**, in whichever
directory the host reads: `.github/agents/` for the Copilot surfaces,
`.claude/agents/` for Claude Code, and `.lex/agents/` for a host with no agent
directory of its own. Only the active mode's agents are present — switching
modes rewrites the directory.

| Mode | Agents installed |
| --- | --- |
| `forward` | `lex-step-00` through `lex-step-19`, plus `lex-step-11-refactor` and support agents |
| `backward` | `lex-reverse-step-00` through `lex-reverse-step-17` |
| `edit` | `lex-edit-*` |
| `review` | `lex-review-*` |
| `test` | `lex-test-*`, plus `lex-docs-reader` |
| `input` | `lex-input-analyst`, `lex-input-parser`, `lex-input-model`, `lex-input-migration`, `lex-input-calc`, `lex-input-reports`, `lex-input-serializers`, `lex-input-tests`, plus `lex-validator` and `lex-docs-reader` |
| `mvp_generator` | `lex-mvp-planner`, `lex-mvp-scoper`, `lex-mvp-implementer`, `lex-mvp-verifier` |
| `mvp_completion` | `lex-step-09` through `lex-step-19`, plus support agents |

Slash commands are installed alongside them: `/lex-brief`, `/lex-app`,
`/lex-resume`, `/lex-reverse`, `/lex-reverse-resume`, `/lex-edit`,
`/lex-review`, `/lex-test`, `/lex-input`, `/lex-deploy`, and `/lex-mvp`.
`mvp_completion` is entered by mode switch rather than a dedicated slash
command.

Invoke an agent by name. Do not go looking for the file that defines it: where
it sits depends on the host, and the server rewrites the directory on every mode
switch.

## Outputs in Downstream Projects

Depending on mode, Lex MCP writes these project-local artifacts:

| Path | Purpose |
| --- | --- |
| `.lex-workflow/manifest.json` | Forward/completion coordinator state |
| `plans/technical_docs/` | Forward planning docs and audit report |
| `plans/business_docs/` | Backward canonical business docs |
| `technical-map/` | AST/wiki module map and `CONTEXT.md` files |
| `reviews/` | Review reports |
| `.lex-test/manifest.json` | Test-mode session state (plan, scenario matrix, execution) |
| `Tests/` | JSON scenario data and `ProcessAdminTestCase` modules |
| `test-runs/` | Per-responsibility test reports and `TEST-REPORT.md` |
| `lex_test_config.yaml` | Test entrypoint and `lex pytest -m <group>` marker groups |
| `.lex-edit/runs/<run_id>.json` | Edit-mode session state, one file per run. Never committed |
| `edits/<run_id>/` | Edit task artifacts and `EDIT-REPORT.md`. Deliberately tracked, so they are committed to the run's branch and show up in its pull request |
| `.lex-input/manifest.json` | Input-mode session state |
| `input-changes/` | Input-change format spec, per-area change logs, `_index.md`, and `INPUT-FORMAT-CHANGE-REPORT.md` |
| `mvp/<run_id>/` | MVP plan, scope, checklist, and `MVP-REPORT.md` |
| `docs/` | Copied Lex framework topic references |
| `AGENTS.md` | Downstream project agent rules written by forward-style setup |

These outputs are created in the downstream project, not inside this
`lex-mcp-local` repository.

## Git and GitHub Ownership

"Opens a PR" and "Merges it" are separate columns because one mode does the
first without the second.

| Mode | Local commits | Pushes | Branches | Opens a PR | Merges it |
| --- | --- | --- | --- | --- | --- |
| `forward` | Yes | Yes | Yes | Yes | Yes, squash, at finalize |
| `mvp_completion` | Yes | Yes | Yes | Yes | Yes, squash, at finalize |
| `edit` | Yes, one per task | Yes | Yes | Yes | No -- a person decides |
| `mvp_generator` | Yes, local only | No | No remote branch | No | No |
| `backward` | No | No | No | No | No |
| `review` | No | No | No | No | No |

Forward-style workflow branches use this shape:

```text
<repo-or-requested-name>/run-NN
```

`NN` is zero-padded and auto-incremented. `notify_step_complete` commits with:

```text
[step-NN/<process>] <summary>
```

Edit branches echo that shape, so both modes' branches sort together in a branch
list, plus a slug of the change so several open edit branches can be told apart
without opening each one:

```text
<project-slug>/edit-NN-<change-slug>
```

`NN` comes from the shared run registry rather than from this checkout, so it is
unique across every worktree of the repository. `notify_task_complete` commits
with:

```text
[edit/<task_id>] <summary>
```

and `finalize_edit` commits the report with:

```text
[edit/report] Edit report for run <run_id>
```

Current caveat: `finalize_workflow(audit_complete=True)` attempts to squash
merge the PR after creating it. The code contains a production-mode helper
intended to disable auto-merge, but the finalize path does not currently call
that helper.

## Error Handling

The MCP server classifies errors as either deterministic auto-fixes or
user-actionable failures.

Auto-fixed examples include commit-summary cleanup, empty commit summaries,
no-op commits, and a few deterministic git repair cases.

User-actionable examples include missing credentials, permission failures,
network errors, missing paths, GitHub API failures, git conflicts, corrupted
state, stale tool surfaces, and unknown errors.

When a tool returns `ok: false`, the coordinator must:

1. Stop all workflow activity.
2. Avoid shell, git, or code workarounds.
3. Present the troubleshooting payload to the user.
4. Wait for user confirmation that the issue is resolved.
5. Retry the same MCP tool.

Unknown errors default to user-actionable.
