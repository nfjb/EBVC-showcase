# Lex Specifications (Canonical, Project-Specific)

This document is the canonical Lex rule set for this repository.

## Lex purpose

- Lex is the base framework contract for generated project code.
- Project models extend Lex primitives and generated code is assembled into a Django-style project structure.
- Lex is an implementation platform, not a standalone audit/traceability requirement policy.

## A) Core class contracts

- Project entity models should extend `LexModel` instead of raw Django model base.
- Business processing/upload/report classes should extend `CalculationModel`.
- `CalculationModel.calculate()` is mandatory for `CalculationModel`-based classes.
- `CalculationModel` internals should not be re-implemented; only `calculate()` is the intended override point.
- `CalculationModel` status lifecycle includes `IN_PROGRESS`, `ERROR`, `SUCCESS`, `NOT_CALCULATED`, `CANCELLED`, `ABORTED` via `is_calculated`. `CANCELLED` is a person stopping a run; `ABORTED` is the framework reclaiming a row whose worker died. See `docs/lex_topics/04-calculationmodel-lifecycle.md`.
- Calculation hook behavior is lifecycle-driven (create/update hooks trigger calculation flow).

## B) Field and schema rules

- Every model should include explicit PK format: `id = models.AutoField(primary_key=True)`.
- Any field ending with `Id` must be `ForeignKey`, never `IntegerField`.
- Relationships are mandatory and should be modeled with `ForeignKey` fields.
- Use direct class references in `ForeignKey` definitions (not string-based references).
- Never use module-style relation strings (forbidden examples: `"Inputs.Config.CompensationPeriod"`, `"Uploads.PeopleFluent.PeopleFluentUpload"`) instead just use the model name (correct examples: `"CompensationPeriod"`, `"PeopleFluentUpload"`).
- Avoid adding extra/useless ID fields not present/justified by data samples.
- For multiple ID-like fields, each must be justified against actual input columns.
- Use only column names that actually appear in input/output samples.

## C) Upload/report model nuances (critical)

- In every upload model, file field is mandatory.
- In every report model, at least one Django `FileField` must exist (field can be optional in null/blank behavior, but the report model must define a file field).
- Upload/report processing is expected through `CalculationModel` and `calculate()`.
- Report models should mirror output-file semantics and extension constraints.
- Report models should include only fields necessary for required report outputs.

## D) Required folder architecture (critical)

- Create and use three top-level functional folders: `Inputs`, `Uploads`, `Reports`.
- `Inputs`: stores transformed/normalized data models populated by upload processing.
- `Uploads`: contains model classes that accept input files and transform/load data into `Inputs` models.
- `Uploads` models may inherit `CalculationModel` when transformation/loading logic is required.
- `Reports`: contains report-generation models.
- `Reports` models must inherit `CalculationModel` and define at least one Django `FileField` for generated report artifacts.
- Any files where helper/ non-model classes are implemented must start with an underscore in their name (eg. `_period_service.py`).

## E) File generation behavior (project-specific override)

- This project is CSV-first.
- Focus only on `.csv` input/output handling for now.
- Do not add non-CSV format requirements unless user explicitly requests them.

## F) Logging behavior

- Logging should use `LexLogger` (`from lex.audit_logging.handlers.LexLogger import LexLogger`).
- `LexLogger` uses a builder pattern: chain `.add_text()`, `.add_heading()`, `.add_table()`, `.add_dataframe()`, `.add_code()` methods, then call `.log()` to persist.
- Logging is scoped to `CalculationModel` / `calculate()` contexts and is context-aware (automatically links to the current calculation and model instance).
- Key operations in business logic should be logged with `LexLogger`.
- For nested calculations, use `model_logging_context` to preserve the parent/child log hierarchy.
- See `docs/lex_topics/11-logging-and-lexlogger.md` for the full API reference.

## G) Code-generation output contracts

- Response format starts with `### path/to/file.py` followed by class code.
- One class per file.
- No placeholders / `pass` for production implementations.
- Strong import discipline: include all required imports and correct project import paths.
- Import targets must resolve to existing modules/classes; generated code must not reference non-existent modules or stale renamed files.
- Respect project constraints including `No class Meta` and `No self.is_calculated usage` in generated code where required by prompt contract.
- All of the modules from Lex must be imported from this import pool and nowhere else:
	from lex.core.models.LexModel import LexModel
	from lex.core.models.CalculationModel import CalculationModel
	from lex.audit_logging.handlers.LexLogger import LexLogger
	from lex.audit_logging.utils.ModelContext import model_logging_context
- Imports of files inside of the created project, do not need to have the project name in front of them (wrong: `project.Inputs.calc`, correct `Inputs.calc`)

## H) Naming, data-model synthesis, and structure generation

- Input files are the primary source for entity model extraction.
- One distinct input model per unique input-column schema.
- Multiple files share a model only when schema is identical.
- Normalize schema and reduce redundancy through relationships.
- Relationships should be represented as fields, not separate relationship classes.
- Single-level folder hierarchy for generated structure where specified.
- Structure/model-stage output must be parsable JSON only (no markdown fences).

### H.1 Naming: plain English, in the customer's own words (critical)

Generated code is read by the customer, not only executed. **You name the things
you create; a name that already exists is not yours to change.** Every name you
introduce — class, field, method, module, folder, local variable, parameter — is
a word or short phrase the customer's own reader would recognise.

**Scope: new material only.** This governs what you write in this run. Existing
names stay as they are. Do not rename a model, field, method, variable, file or
column because it fails this rule — not in code you are editing, not in code you
happen to read, not as a cleanup. A run that starts renaming the app it was asked
to change pulls in call sites, migrations, serializers, tests and the technical
map that nobody asked for. Fixing existing names is a separate, explicitly
requested job. Adding a field to a model whose siblings are abbreviated? Name
your field by this rule and leave theirs alone.

**The customer's term wins, and it never changes.**

- **Their word beats your better word.** A term in a column header, a brief, a
  contract or a filename *is* the term — even when yours is clearer, more
  standard, or more grammatically correct. `leaver` is what their team calls
  someone who has left; you do not promote it to `departure` because `departure`
  is tidier. You are not the audience.
- **Pick once, then never drift.** One concept, one term, for the life of the
  project: model, field, method, variable, artifact heading, report prose, commit
  message. `LeaverCases` in one step and `DepartureCases` in the next is the same
  defect as a typo, and worse, because both spellings look deliberate. If you are
  about to write a synonym, you have already chosen the term — go back and use it.
- **Translation is about language, not word choice.** Translate a non-English
  term when the customer has no English word for it (`Abgang` to `Departure`),
  and record the original beside it. Swapping an English synonym for an English
  domain term is not translation.

**The specifics.** No abbreviations, no acronyms you invented, no single letters:
`dataframe` not `df`, `error` not `e`, `expected` / `actual` not `gt` / `act`,
`calculation` not `calc`. Three characters or fewer is too short, and so is
all-lowercase-with-no-underscore of six or fewer — unless it is an ordinary word
(`row`, `fund`, `fee`, `date`, `total`). Say what a name holds, not what type it
is: `charge_rows`, not `data`. Two or three words is usually enough:
`calculate_category_irr`, not
`calculate_internal_rate_of_return_by_category_for_quarter`. **Any word the
customer writes down is a word** — an acronym (`NAV`, `IRR`, `VAT`) or an
odd-sounding domain term (`lever`, `leaver`, `vintage`, `hurdle`); only what
*you* shortened needs expanding, and **the length floors above never apply to a
customer's term**. Spell it correctly. CapitalCase for class and folder names,
snake_case for fields, methods, modules and locals.

**Never rename these. Lex breaks silently, not loudly:**

| Fixed by | Names |
| --- | --- |
| Framework | `calculate`, `update`, `pre_validation`, `post_validation`, `permission_read` / `edit` / `create` / `delete` / `export` / `list`, `get_selected_key_list`, `streamlit_main`, `streamlit_class_main`, `track`, `untrack`, `save_without_historical_record`; the attributes `is_calculated`, `defining_fields`, `parallelizable_fields`, `api_serializers`, `hide_actions_column` |
| Section B | Any field ending `Id` — the suffix is what forces `ForeignKey` |
| Section B | Input and output **column strings**, byte for byte from the sample: case, spacing, underscores, however abbreviated |
| Section D | `Inputs`, `Uploads`, `Reports`; helper modules starting `_` |
| `10-process-admin-and-model-structure.md` | `model_structure.yaml` leaf keys — the lowercased class name |
| `02-project-structure-discovery.md` | `_structure.py`, `_streamlit_structure.py` |
| `23-testing-and-test-data.md` | `Tests/`, `test_data.json`, `lex_test_config.yaml`, `pytestmark` group names |

A source column named `cntrct_id` is read by that exact string and stored in a
field you name `contract`. Fix the name you own; never the name the file owns.

## I) Implementation boundary (project-specific)

- Implementation phase must deliver project code, not only implementation plans.
- Do not generate Django project scaffolding files as deliverables for this phase.
- Do not introduce `apps.py`, `urls.py`, `settings.py`, or similar Django project-bootstrap artifacts unless the user explicitly requests them.

## J) Lex app runtime context (baked reference, critical)

- Canonical baked Lex runtime context file for this repository is: `docs/lex_topics/21-LEX-APP-CONTEXT.yaml`.
- This YAML is a docs-local copy of `metagpt/lex_app_context.yaml` and must be treated as authoritative context for framework-level behavior.
- Planning and implementation prompts should explicitly load this YAML whenever behavior/details of `LexModel`, `CalculationModel`, or logging patterns are needed.
- If any ambiguity exists between generated assumptions and framework lifecycle/permission behavior, resolve it by consulting this YAML first.
- Trace marker for retrieval: `LEX_APP_CONTEXT_SOURCE=docs/lex_topics/21-LEX-APP-CONTEXT.yaml`.

### J.1 Minimal in-file context trace (for prompt anchoring)

```yaml
LEX_APP_CONTEXT_SOURCE: docs/lex_topics/21-LEX-APP-CONTEXT.yaml
CONTAINS:
	- CalculationModel lifecycle/status semantics
	- LexModel validation/permission hooks
	- Logger usage/logging patterns
USAGE_RULE:
	- Load before implementation when framework internals are referenced
```

## K) Mandatory implementation sequencing rule (project-specific)

- Implementation workflow must include explicit plan-validation and code-validation gates.
- All steps (0–14) are served by the unified `get_plan_step` tool. There is no separate implementation step tool.
- The step flow includes plan-validation and code-validation gates at designated steps (loaded from MCP).
- The implementation phase must deliver complete project code, not only implementation plans.
- Do not treat implementation as complete unless both a code-delivery step and a code-level compliance gate have passed.

## L) Import, services, and dependency-safety rules (critical)

- Models should not import service modules unless explicitly required by the framework hook contract; prefer service-layer orchestration to reduce dependency cycles.
- Prevent circular imports by including the necessary imports inside of the functions that they are needed in. 
- Add and enforce import integrity checks in validation gates to catch unresolved imports, stale module paths, and relation target mistakes before approval.

## M) Unknowns are disclosed, never invented (critical)

- A value you cannot source is an **open question**, not a decision. Record it
  where the next reader will hit it — the plan, the contract, the test report —
  and say what you assumed in the meantime.
- **Never invent an expected numeric value, and never read one off a run.** A
  number taken from the application's own output can only fail if the
  application becomes non-deterministic, so an assertion built on it tests
  nothing. Expected figures come from outside the app: a ground-truth workbook
  under `Tests/GroundTruth/`, or a stated acceptance criterion.
- **Never infer a column's meaning, a business rule, or a permission from
  nothing.** If the input samples and the stated requirements do not settle it,
  ask; if nobody answers, write down what you assumed rather than letting the
  code be the only record of the guess.
- A criterion you cannot ground is reported **uncovered**. An honest gap is a
  fact; a silent default is a claim nobody made.

## Enforcement rule

- Treat this file as authoritative for planning and implementation prompts in this repository.
