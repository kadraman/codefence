---
title: "Hooks and Background Scanning"
id: 10
slug: "hooks"
status: specified
authors: ["@kadraman"]
created: 2026-09-19
updated: 2026-09-19
issue: "https://github.com/kadraman/codefence/issues/10"
area: hooks
---

# Feature Specification: Hooks and Background Scanning

## Summary

Provide Git pre-commit and IDE background scanning flows for `codefence`. Cache findings under `.codefence/cache/code/` with debounce behavior matching the hooks docs.

## Problem

Hooks must block bad commits and warm IDE caches. Hooks must invoke the `codefence` binary (not a separate runtime). Debounce and cache paths must stay stable so editors and pre-commit behavior remain consistent.

## User scenarios

### User Story 1 — Pre-commit blocks on findings (Priority: P1)

**Why this priority**: Primary guardrail for commits; exit non-zero must block the Git commit.

**Independent test**: Temp git repo with a failing staged scan yields non-zero `codefence pre-commit` exit code.

**Acceptance scenarios**:

1. **Given** a repo with staged changes that produce findings, **When** `codefence pre-commit` runs, **Then** it runs the equivalent of `scan --staged` and exits non-zero so the commit is blocked.
2. **Given** a clean staged set with no findings, **When** `codefence pre-commit` runs, **Then** exit code is 0.
3. **Given** pre-commit runs in v1, **When** reporting cache stats, **Then** a full staged scan still runs (cache may report hit rate but does not skip the staged scan).

### User Story 2 — Background scan + worker + debounce (Priority: P1)

**Why this priority**: IDE on-save warming depends on debounce and the worker writing the code cache.

**Independent test**: Fake-clock debounce tests plus worker writing per-file findings under `.codefence/cache/code/`.

**Acceptance scenarios**:

1. **Given** `codefence background-scan` receives a file path via flag, stdin JSON, or env, **When** invoked, **Then** it applies debounce and spawns `scan-worker` as specified.
2. **Given** the first save of a file, **When** debounce runs, **Then** a scan starts immediately.
3. **Given** further saves within the debounce window (default **2s**), **When** edits continue, **Then** the timer resets and one follow-up runs after edits stop.
4. **Given** a scan just completed for a target, **When** another identical target would be re-queued immediately, **Then** it is not re-queued immediately after that scan.
5. **Given** debounce state is needed across invocations, **When** state is persisted, **Then** it lives in `.codefence/debounce.json`.
6. **Given** `codefence scan-worker --file <path>` runs, **When** the scan completes, **Then** per-file findings are written to `.codefence/cache/code/`.

### User Story 3 — Install hooks (invoke binary on PATH) (Priority: P1)

**Why this priority**: Hooks must invoke the `codefence` binary on PATH (or configured absolute path).

**Independent test**: `install-hooks --dry-run` writes nothing; real run installs `.git/hooks/pre-commit` and creates IDE hooks.json only if missing (never overwrite).

**Acceptance scenarios**:

1. **Given** `codefence install-hooks`, **When** Git hooks are installed, **Then** `.git/hooks/pre-commit` is a portable script that invokes `codefence pre-commit` via PATH lookup (or documented absolute path config).
2. **Given** `.cursor/hooks.json` is missing, **When** install-hooks runs, **Then** it creates hooks.json mapping `afterFileEdit` → `codefence background-scan`.
3. **Given** `.cursor/hooks.json` already exists, **When** install-hooks runs, **Then** it does **not** overwrite the file.
4. **Given** `.kiro/hooks.json`, **When** install-hooks runs, **Then** the same create-if-missing / never-overwrite policy applies.
5. **Given** `--dry-run`, **When** install-hooks runs, **Then** no files are written.
6. **Given** documentation for hooks, **When** PATH requirements are described, **Then** they state the binary must be on PATH or an absolute path must be configured.

### Edge cases

- Missing `codefence` on PATH → install/docs must make failure mode clear (actionable error when hook runs).
- stdin JSON shape for background-scan includes `file_path` (example: `{"file_path":"src/main.go"}`).
- Idempotent re-run of install-hooks for hooks.json when file already exists.

## Requirements

### Functional requirements

- **FR-001**: System MUST provide `codefence pre-commit` that runs `scan --staged` and exits non-zero on findings to block commits.
- **FR-002**: System MUST provide `codefence background-scan` accepting file path via flag, stdin JSON, or env; debounce; spawn worker.
- **FR-003**: System MUST provide `codefence scan-worker` accepting `--file <path>` that performs the scan and writes the code cache.
- **FR-004**: System MUST provide `codefence install-hooks` (with `--dry-run`) installing Git hook + optional Cursor/Kiro hooks.json.
- **FR-005**: Installed hooks MUST invoke the `codefence` binary directly (PATH or absolute path); see `specs/global/compatibility.md`.
- **FR-006**: Debounce default MUST be **2s** with first-save immediate scan, timer reset on further saves, no immediate re-queue after a just-completed scan, and state in `.codefence/debounce.json`.
- **FR-007**: Worker MUST write per-file findings to `.codefence/cache/code/`.
- **FR-008**: Pre-commit MAY report cache hit rate but MUST still run full staged scan in v1.
- **FR-009**: `.cursor/hooks.json` and `.kiro/hooks.json` MUST be created if missing and MUST NEVER be overwritten if present.

### Non-goals

- Skipping full staged scan based on code cache in v1.
- Network listeners for background workers (constitution: no background network port in v1).
- Inventing additional IDE hosts beyond Cursor/Kiro hooks.json as listed.

## Success criteria

- **SC-001**: Temp git repo test: failing scan blocks simulated pre-commit exit code.
- **SC-002**: Debounce unit tests with fake clock cover first save, window reset, and no immediate re-queue.
- **SC-003**: `install-hooks --dry-run` writes nothing; real run is idempotent for existing hooks.json (no overwrite).
- **SC-004**: User-facing hooks docs (`docs/hooks.md`) describe binary PATH / absolute path requirements.

## Assumptions

- `scan --staged` semantics come from features `001` / `005`.
- Local state paths for debounce and code cache align with `002-config-and-env`.

## Open questions

_(none beyond documenting PATH requirements.)_

## References

- Related: `001-cli-and-commands`, `005-scan-orchestrator`, `global/compatibility.md`
- Docs: `docs/hooks.md`
