# Examples & API Endpoints

Search keywords: examples, endpoint reference, CRUD, model info, auth endpoints

## Scope

- Consolidated map to full example blocks
- Practical endpoint categories used by assistants during implementation/debugging

## The two worked examples

Complete, commented models. Everything below is a map *into* these:

| File | Shows |
| --- | --- |
| [`_context/lex_examples/LexModelExplain.py`](../_context/lex_examples/LexModelExplain.py) | A full `LexModel`: `UserContext` / `PermissionResult` field-level permissions, tracking hooks, status handling |
| [`_context/lex_examples/CalculationModelExplain.py`](../_context/lex_examples/CalculationModelExplain.py) | A full `CalculationModel`: `IN_PROGRESS -> SUCCESS/ERROR` flow, Celery dispatch with a synchronous fallback, report generation into a `FileField` |

Read them as pattern references, not as import-ready modules. `LexModel` and
`CalculationModel` are preimplemented framework internals — subclass them, never
copy their internals into project UML, pseudocode, or implementation plans.

## Example Buckets

- Simple data model with permission overrides
- Calculation model patterns
- Combinatorial model patterns
- Serializer + restriction integration patterns
- Transaction and celery task patterns
- HTML report and structure YAML examples

## Endpoint Buckets

- Core: process tree/metadata and project info
- CRUD: one/list/many operations by model id
- Model info: serializers, fields, permissions, filters
- Auth: current user, user permissions, streamlit token
- Operational: global search, calculation-log endpoints, health checks

## LLM Prompt Starters

- "Map this use case to Lex endpoint categories and provide the minimal endpoint set to implement it."
- "Select the closest Lex example pattern and adapt it to this model with only required changes."
