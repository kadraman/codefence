# Codefence Constitution

**Version**: 1.0.0 | **Ratified**: 2026-09-19 | **Last Amended**: 2026-09-19

This document is binding on all specifications, plans, tasks, and implementations. Feature specs MUST NOT contradict it. If they conflict, change the spec — not this constitution — unless the constitution is being amended on purpose.

Every `plan.md` MUST include a **Constitution Check** against these principles.

---

## I. Specifications First (NON-NEGOTIABLE)

- Do not invent CLI flags, config keys, rule IDs, finding fields, MCP tools, or scan semantics.
- Do not infer intent from code alone when a spec exists under `specs/`.
- Align the implementation with documented specs (`specs/` is authoritative for engineering behavior).
- Only implement features that are specified under `specs/features/` (or `specs/complete/` for shipped behavior), or that the user has explicitly approved.
- If essential information is missing, ask before implementing.

## II. Production Quality (NON-NEGOTIABLE)

Codefence is a production-quality security guardrail CLI and library, not a prototype. Prefer correctness, determinism, and long-term maintainability over speculative abstraction.

- Go only for the implementation in this repository.
- No stub logic in shipped command or scan paths.
- Prefer boring, explicit code and stdlib over heavy frameworks.
- Default release builds: `CGO_ENABLED=0`.

## III. Core Contracts Are Stable (NON-NEGOTIABLE)

These subsystems are core infrastructure. Changes require spec review, downstream impact analysis, and tests updated first or in parallel:

- Aspect model (`code`, `deps`) and scan orchestration
- Finding schema (library / MCP) and CLI NDJSON wire shape
- Config schema (`codefence-config.yml` v1) and `CODEFENCE_*` env names
- Secret rule IDs and Semgrep-subset YAML surface
- Dependency extractor ecosystems and OSV provider defaults
- MCP tool names and input schemas

Do **not** casually rename wire fields, rule IDs, or aspect IDs.

## IV. Behavioral Stability

- Public CLI, config, finding, and rule contracts MUST remain stable unless a feature spec documents a deliberate change (with migration notes).
- Shared assets (builtin secret YAML, AI templates, fixtures) keep stable IDs and marker names.
- Deliberate v1 differences already accepted in specs (e.g. CLI exit code `2` for usage/config errors; hooks invoke the `codefence` binary on PATH) MUST be documented in the relevant feature and in [`global/compatibility.md`](global/compatibility.md).

## V. Size and Startup (NON-NEGOTIABLE)

- Binary size and startup latency are product requirements. Hard budgets in [`global/nfr.md`](global/nfr.md) gate releases.
- New direct dependencies require justification against the NFR allowlist and budget B7.
- Lazy-init: help, version, and MCP `initialize` / `tools/list` MUST avoid unnecessary work.

## VI. Security Boundaries (NON-NEGOTIABLE)

- Do not exfiltrate file contents beyond finding evidence snippets already specified.
- Remote secret-rule downloads require integrity verification before cache activation.
- OSV queries send package coordinates only, not source bodies.
- MCP tools operate only within the configured cwd; reject path escapes.
- v1 background workers MUST NOT listen on a network port (MCP stdio only unless a later spec enables Streamable HTTP).

## VII. Tests Back Behavior (NON-NEGOTIABLE)

- New behavior requires tests.
- Refactors MUST NOT reduce coverage of parity or NFR gates.
- Acceptance criteria in feature specs MUST be executable (unit, fixture, CLI, and/or MCP tests as listed).

## VIII. CLI and Library Boundaries

- `cmd/codefence` is a thin entry; scan semantics live in `internal/scan` (and related packages).
- CLI and MCP MUST share the same `RunScan` / library API and config precedence.
- Optional `pkg/codefence` exposes only a stable subset; do not leak internal packages as public API without a spec.

## IX. Agent Constraints

Agents MUST NOT:

- invent undocumented flags, config keys, rule IDs, finding fields, or MCP tools
- change NDJSON wire keys or Finding field names without an accepted migration in the output/findings specs
- expand scope beyond the open checklist in the active feature’s `tasks.md`
- mark a feature complete without updating `STATUS.md` and moving the folder per process

Agents MUST:

- read this constitution, relevant `specs/global/` contracts, and the **active** feature folder
- use `STATUS.md` to find related shipped specs instead of loading all of `complete/`
- link `spec.md` (and `plan.md` / `tasks.md` for feature work) from implementation PRs

## X. Governance

- Amend this constitution only deliberately; record version and date.
- Feature `plan.md` Constitution Checks cite the principles above.
- Process details: [`README.md`](README.md). Index: [`STATUS.md`](STATUS.md).
