# Transactions & Deferred Recalculation

Search keywords: as_transaction, deferred recalculation, ObjectsToRecalculateStore

## Scope

- Transaction-safe update batching
- Deferral and replay of dependent recalculations

## Key Points

- `as_transaction` groups operations to avoid inconsistent intermediate states.
- Dependent recalculations can be queued/deferred until transaction boundaries complete.
- Recalculation stores coordinate downstream recomputation deterministically.

## LLM Prompt Starters

- "Refactor this batch update into `as_transaction` and preserve recalculation consistency."
- "Explain deferred recalculation behavior and when queued objects are replayed."
