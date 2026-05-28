# GitHub Copilot Instructions For Codefence

## Project Overview

Codefence is a Node.js + TypeScript CLI that provides security guardrails for AI-assisted coding.

- npm package: `codefence`
- CLI: `codefence`
- Primary behaviors: `scan`, `install`, `install-hooks`, `pre-commit`, `background-scan`

Treat this repository as production code and prefer safe, minimal, test-backed changes.

## Source Of Truth

When implementing or changing behavior, follow this order:

1. `docs/features/*.md` (feature behavior and scope, when present)
2. `README.md` (user-facing behavior and commands)
3. `docs/AI-ASSISTANTS.md` and `docs/HOOKS.md` (integration behavior)
4. `CONTRIBUTING.md` (repo workflows and expectations)
5. Explicit user request in the current task

Do not invent features or undocumented flags. If behavior is unclear, ask or keep changes conservative.

## Repository Reality Checks

- Module type is currently `commonjs` (`package.json`), not ESM-only.
- `docs/features/` may be empty initially; once feature docs are added, treat them as highest-priority specs.
- Local scans are embedded and run via `codefence scan --staged`.

## Coding Rules

- Use TypeScript in `src/`.
- Keep changes explicit and easy to review.
- Avoid unrelated refactors and formatting churn.
- Preserve backward compatibility unless the user asks for a breaking change.

## Testing And Validation

For behavior changes:

1. Add or update tests in `tests/`.
2. Run `npm test`.
3. Before completing, run `codefence scan --staged` (or `npm run codefence` if `codefence` is not on PATH).

If checks fail, fix findings and re-run until success unless the user explicitly accepts the risk.

## Workflow Expectations

- Implement incrementally.
- Update docs when user-facing behavior changes.
- Keep templates and installed artifacts consistent (for example under `templates/ai/` and `.cursor/rules/`).
- Prioritize correctness and maintainability over speed.
