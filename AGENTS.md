# Skarv Ventures deal-flow triage — notes for AI agents

Next.js 16 (App Router) + React 19 + TypeScript, styled with Tailwind CSS v4 and shadcn/ui
(Radix, Nova preset). Everything runs in the browser: the CRM is
an in-memory store in the tab (`src/lib/db/connection.ts`), nothing is persisted. Read
`README.md` first; the product brief is `docs/planning/mvp-spec.md`.

## Where things live

- `src/lib/triage/`: the triage rules, pure and framework-free. Change behaviour here.
- `src/lib/db/`: the in-memory store (`connection.ts`) and typed queries (`repository.ts`).
- `src/lib/crm/`: the pipeline run, the human actions (`actions.ts` wraps them for buttons),
  and page data.
- `src/app/`: pages (client components; call `useCrm()` so they re-render on changes).
- `src/components/`: client components. `ui/` is shadcn's generated components (add more with
  `npx shadcn@latest add <name>`); `page.tsx` has the shared headings, notices and tables.
- `src/app/globals.css`: Tailwind and the Skarv palette as shadcn theme tokens (`--primary` is
  Skarv red, `--secondary` is ink). Style with utility classes, not new CSS.
- `config/`: every number the rules use. Prefer changing config over code.

## Rules that must hold

1. **Time in queue never changes score, urgency or priority.** It only raises the 14/21-day
   flags. Tests enforce this.
2. **Companies are scored, never founders.** The score is the O1 Venture investment
   criteria (`src/lib/triage/scoring.ts`, weights and bands in `config/weights.yaml`). All
   ten O1 ratings and the storytelling bonus are only ever set by a person (`saveRatings`);
   the pipeline never fills them, so a new company scores 0 % until someone rates it.
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
