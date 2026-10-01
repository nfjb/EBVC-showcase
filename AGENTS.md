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
- `src/app/globals.css`: Tailwind and the theme tokens: shadcn's neutral palette with Skarv
  red as `--primary`, plus status colours (`success`, `warning`, `info`, `error`).
- **UI is shadcn first.** Build every control from `src/components/ui` (Sidebar, Card, Table,
  Tabs, Dialog, Command combobox, Accordion, Pagination, Chart, Empty, Field, Item, Sonner…);
  add missing ones with `npx shadcn@latest add <name>`. Style with utility classes, not new
  CSS. Links must be Next.js `Link` (a full reload would wipe the in-tab CRM).
- `config/`: every number the rules use. Prefer changing config over code.

## Rules that must hold

1. **Time in queue never changes score, urgency or priority.** It only raises the 14/21-day
   flags. Tests enforce this.
2. **The Fathom agent rates, a person can override.** The score is the Fathom investment
   criteria (`src/lib/triage/scoring.ts`, weights and bands in `config/weights.yaml`). After
   every upload the Fathom rating agent (`src/lib/crm/agent.ts`) rates all ten dimensions with a
   three-sentence rationale: pre-rated offline for the demo (`demo/fathom_ratings.json`,
   `npm run demo:prerate`, no API call), live via `/api/rate` (OpenAI) only for other
   companies and only when a person presses the button — never automatically, it costs credits. A person's ratings (`saveRatings`) always win: the agent
   never overwrites them. The pipeline itself (`planPipeline`, `runPipeline`) still rates
   nothing. The team is rated on team evidence only, never on personal attributes.
3. **Every human action writes a Decision row in the same transaction** (`atomic`). If the
   row cannot be written, nothing is saved. The pipeline and the Fathom agent write no Decisions;
   the agent's ratings are recorded on the company (`rating_source`, `rated_by`, `rated_at`).
4. **Fuzzy name matches are only suggestions.** Nothing merges without a person approving.
5. **Sending is simulated.** Replies go to the Outbox and the audit log, nowhere else.
6. **Status is never colour alone**: always a text label, with the icon reinforcing it.
   UI text is British English.
7. **Python semantics are deliberate.** Use `pyRound` / `pyFixed` (not `Math.round` /
   `toFixed`), `pyStrip` / `pySplit`, and `compareCodePoints` in `src/lib/triage/py.ts`.
   Dates are `YYYY-MM-DD` strings handled in UTC (`src/lib/triage/dates.ts`).
8. Field names stay snake_case, matching the database columns and `config/`.
9. **AI never decides and never sees personal data.** Only company-level information goes
   to OpenAI (never founder names, email addresses, LinkedIn profiles or introducer names). The
   key lives only in the server route `src/app/api/rate/route.ts` (via `src/lib/ai/openai.ts`).
   The Fathom agent proposes ratings.
   Neither advances or passes a deal: people do.

## Checks

```bash
npm test && npm run typecheck && npm run build
```
