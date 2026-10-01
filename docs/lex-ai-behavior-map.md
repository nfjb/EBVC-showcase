# Lex AI Behavior Map

**This file is superseded. Read [`mcp-modes.md`](mcp-modes.md) instead.**

It used to trace the intended flow for each task shape alongside the mode docs.
It described a world with two modes — `forward` and `backward` — and never
learned about `brief`, `edit`, `review`, `test`, `input`, `deploy`,
`mvp_generator`, or `mvp_completion`. A wrong map is worse than no map, because
it reads exactly like a right one.

| You want to know | Read |
| --- | --- |
| Which mode a request belongs to | [`mcp-modes.md`](mcp-modes.md) — the intent table and disambiguation rules |
| What each mode does, and what it outputs | [`mcp-modes.md`](mcp-modes.md) — the per-mode summaries |
| How a mode executes: coordinator, agents, kickstart, halting | [`mcp-execution-model.md`](mcp-execution-model.md) |
| How to switch modes, and when | [`mcp-modes.md`](mcp-modes.md) — Switching Guidance |

The one thing worth carrying forward: **`brief` is the default mode.** It
interviews the user about what they want, writes `.lex/contract.md`, and
switches to the mode that work needs. Every other mode's entry tool reads that
contract, and every mode can switch back to `brief` when the next request
belongs somewhere else.
