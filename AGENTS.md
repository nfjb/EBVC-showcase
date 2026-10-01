# Skarv Ventures deal-flow triage — notes for AI agents

Next.js 16 (App Router) + React 19 + TypeScript + SQLite (`better-sqlite3`). Read
`README.md` first; the product brief is `docs/planning/mvp-spec.md`.

## Where things live

- `src/lib/triage/`: the triage rules, pure and framework-free. Change behaviour here.
- `src/lib/db/`: schema (`schema.ts`) and typed queries (`repository.ts`).
- `src/lib/server/`: the pipeline run, the human actions, and page data.
- `src/app/`: pages (server components) and `actions.ts` (server actions).
- `src/components/`: client components.
- `config/`: every number the rules use. Prefer changing config over code.

## Rules that must hold

1. **Time in queue never changes score, urgency or priority.** It only raises the 14/21-day
   flags. Tests enforce this.
2. **Companies are scored, never founders.** `team` and `market` are only ever set by a
   person (`saveRatings`). The pipeline never fills them.
3. **Every human action writes a Decision row in the same transaction** (`atomic`). If the
   row cannot be written, nothing is saved. The pipeline writes no Decisions.
4. **Fuzzy name matches are only suggestions.** Nothing merges without a person approving.
5. **Sending is simulated.** Replies go to the Outbox and the audit log, nowhere else.
6. **Status is never colour alone**: always a text label, with the icon reinforcing it.
   UI text is British English.
7. **Python semantics are deliberate.** Use `pyRound` / `pyFixed` (not `Math.round` /
   `toFixed`), `pyStrip` / `pySplit`, and `compareCodePoints` in `src/lib/triage/py.ts`.
   Dates are `YYYY-MM-DD` strings handled in UTC (`src/lib/triage/dates.ts`).
8. Field names stay snake_case, matching the database columns and `config/`.

## Checks

```bash
npm test && npm run typecheck && npm run build
```
