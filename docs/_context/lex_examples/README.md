# Example Lex model files

Reference implementations of the Lex model patterns, for use as planning and
implementation context.

- [`LexModelExplain.py`](LexModelExplain.py) — `LexModel` patterns: hooks,
  permissions, `UserContext`, `PermissionResult`, status transitions.
  **Framework source throughout.** Read it to understand what the base class
  does; there is no customer code in it to imitate.
- [`CalculationModelExplain.py`](CalculationModelExplain.py) —
  `CalculationModel` lifecycle and report flows. **Two files in one**:
  framework source down to the `END OF FRAMEWORK SOURCE` divider, then one
  real customer application, `TargetTrackRecord`. The file says so in its
  module docstring and again at the divider.

## How to use them

- Read them as **pattern references** when planning or implementing hooks,
  permissions, status transitions, and report flows.
- **Imitate the customer half, never the framework half.** Naming, structure
  and style in framework source are facts about Lex, not examples to follow —
  `20-LEX-SPECIFICATIONS.md` section H.1 governs the code you write, not the
  code you are reading.
- Do **not** treat them as import-ready modules for this project's packages.
- Treat the Lex framework classes they show — `LexModel`, `CalculationModel` —
  as preimplemented internals. Do not copy or recreate those base-class
  internals into project UML, pseudocode, or implementation plans.

Cited from [`04-calculationmodel-lifecycle.md`](../../lex_topics/04-calculationmodel-lifecycle.md)
and [`06-permissions-authorization.md`](../../lex_topics/06-permissions-authorization.md).
