# Agent guide (Codefence)

Engineering authority stack (highest first):

1. [`specs/constitution.md`](specs/constitution.md)
2. [`specs/global/`](specs/global/)
3. Active feature under [`specs/features/NNN-slug/`](specs/features/) (or shipped [`specs/complete/`](specs/complete/) when changing that behavior)
4. [`docs/`](docs/) — user-facing; not a substitute for specs
5. Code

Process: [`specs/README.md`](specs/README.md). Index: [`specs/STATUS.md`](specs/STATUS.md).

## Rules

- Do not invent CLI flags, config keys, rule IDs, finding/NDJSON fields, or MCP tools.
- Do not infer unspecified behavior from code alone when a spec exists.
- Implementation PRs that change user-visible behavior MUST link `spec.md` (and `plan.md` / `tasks.md` for feature work).
- Prefer the smallest slice that greens the active feature checklist.

## Suggested read order for a new task

1. Constitution
2. Relevant global contracts (architecture, nfr, testing, compatibility)
3. The single active feature folder for the task
4. Related shipped specs via STATUS only as needed
