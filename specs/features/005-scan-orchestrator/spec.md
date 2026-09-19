---
title: "Scan Orchestrator"
id: 5
slug: "scan-orchestrator"
status: specified
authors: ["@kadraman"]
created: 2026-09-19
updated: 2026-09-19
issue: "https://github.com/kadraman/codefence/issues/5"
area: scan
---

# Feature Specification: Scan Orchestrator

## Summary

Implement a scan orchestrator that builds a `ScanContext`, resolves aspects (`code`, `deps`), runs them sequentially, aggregates exit codes, and emits status messages. The same `RunScan` API is used by CLI, pre-commit, hooks workers, and MCP `scan`.

## Problem

Without a single orchestrator, CLI and MCP would diverge on file scoping, aspect auto-enable, and exit semantics — breaking agent guardrails that assume `codefence scan --staged` meaning.

## User scenarios

### User Story 1 — Resolve files and build ScanContext (Priority: P1)

**Why this priority**: Every scan depends on correct cwd, file list, and scoping flags.

**Independent test**: Unit/integration tests with temp git repos and `--paths` expansion.

**Acceptance scenarios**:

1. **Given** `--paths` is provided, **When** the orchestrator builds context, **Then** directories expand to files, `explicitPaths=true`, and demo ignore lists are bypassed.
2. **Given** no `--paths` and `--staged`, **When** the orchestrator builds context, **Then** the file list is staged git changes.
3. **Given** no `--paths` and not `--staged`, **When** the orchestrator builds context, **Then** the file list is unstaged/working-tree changes.
4. **Given** a git-based scan (not explicit `--paths`), **When** config has `git_ignored_prefixes`, **Then** those prefixes are applied; explicit `--paths` does **not** apply them.
5. **Given** `--deps-scope tree`, **When** context is built, **Then** all manifests under the repo or `--paths` roots are discovered, skipping `node_modules`, `.git`, and vendor-like heavy dirs.

### User Story 2 — Resolve aspects including auto-deps (Priority: P1)

**Why this priority**: Auto-inclusion of `deps` and `--skip deps` are core contract behavior.

**Independent test**: Aspect-resolution matrix unit tests.

**Acceptance scenarios**:

1. **Given** no `--only` and default aspects, **When** aspects resolve, **Then** the starting set is `--only` or env/config/`defaultAspects` (default `[code]`).
2. **Given** `--skip` lists aspects, **When** aspects resolve, **Then** those aspects are filtered out of the selected list.
3. **Given** dependency manifests are in scope (or `--deps-scope tree`), and the user did **not** specify `--only`, and did **not** specify `--skip deps`, **When** auto-deps runs **after** the `--skip` filter, **Then** `deps` is auto-added.
4. **Given** the user specified `--only`, **When** auto-deps would otherwise apply, **Then** `deps` is **not** auto-added beyond the `--only` set.
5. **Given** the user specified `--skip deps`, **When** auto-deps runs, **Then** implementations MUST re-check `--skip deps` so `deps` is **not** re-added after an explicit skip.
6. **Given** `--skip code` only (not `--skip deps`), **When** manifests are in scope, **Then** auto-inclusion of `deps` is **not** suppressed.

### User Story 3 — Run aspects and aggregate exit (Priority: P1)

**Why this priority**: Exit semantics and ordering must be identical for CLI and MCP.

**Independent test**: Runner tests with mock aspects; shared `RunScan` used by CLI and MCP.

**Acceptance scenarios**:

1. **Given** both `code` and `deps` are selected, **When** aspects run, **Then** they run **sequentially** in registry order (`code` then `deps`).
2. **Given** any aspect status is `failed`, **When** the run completes, **Then** process exit code is `1`.
3. **Given** quiet/verbose/format controls, **When** the orchestrator prints status, **Then** quiet/verbose/format status logging behaves as specified for the chosen format.

### Edge cases

- What happens when no files are in scope but `--deps-scope tree` discovers manifests?
- What happens when `--only deps` and `--deps-scope tree` are combined?
- What happens when git is unavailable for a git-based file list?

## Requirements

### Functional requirements

- **FR-001**: System MUST resolve working directory (`cwd`) and build `ScanContext` with files, staged flag, explicit-paths flag, optional deps manifest paths for tree scope, and scan options.
- **FR-002**: System MUST expand `--paths` directories to files and set `explicitPaths=true` (bypass demo ignore lists).
- **FR-003**: System MUST select staged vs unstaged/working-tree files via git when `--paths` is absent. Prefer calling the `git` CLI for fidelity.
- **FR-004**: System MUST apply `git_ignored_prefixes` from config for git-based scans only (not for explicit `--paths`).
- **FR-005**: System MUST discover manifests for `--deps-scope tree`, skipping `node_modules`, `.git`, and vendor-like heavy dirs.
- **FR-006**: System MUST resolve aspects from `--only` or env/config/`defaultAspects` (default `[code]`), then apply `--skip`.
- **FR-007**: System MUST auto-add `deps` when manifests are in scope (or `--deps-scope tree`), unless `--only` was specified or `--skip deps` was specified; auto-add runs after `--skip` and MUST re-check `--skip deps`.
- **FR-008**: System MUST NOT suppress auto-inclusion of `deps` when only other aspects are skipped (e.g. `--skip code`).
- **FR-009**: System MUST run aspects sequentially in registry order (`code` then `deps` when both present).
- **FR-010**: System MUST aggregate exit: any aspect `failed` → process exit `1`.
- **FR-011**: System MUST expose a shared `RunScan(ctx, opts)` API used by `codefence scan`, pre-commit, hooks workers, and MCP `scan`.
- **FR-012**: System MUST support quiet/verbose/format controls when printing status.

### Conceptual types

```go
type AspectID string // "code" | "deps"

type ScanContext struct {
    CWD               string
    Files             []string
    Staged            bool
    ExplicitPaths     bool
    DepsManifestPaths []string // nil unless tree scope
    Options           ScanOptions
}

type AspectOutcome struct {
    Aspect   AspectID
    Status   string // ok | skipped | failed
    ExitCode int
    Message  string
}
```

### Non-goals

- Implementing secure-coding rule bodies (feature `006`).
- Implementing secret engine internals (feature `007`).
- Implementing deps extractors / OSV query (features `008`, `009`).
- Inventing new aspect IDs beyond `code` and `deps`.

## Success criteria

- **SC-001**: Aspect resolution matrix covers `only`, `skip deps` vs `skip code`, manifest present/absent, and tree scope; `--skip deps` never yields `deps` after auto-add.
- **SC-002**: Temp git repos verify staged/unstaged selection.
- **SC-003**: Tree discovery skips `node_modules`.
- **SC-004**: CLI and MCP invoke the same `RunScan` path.
- **SC-005**: Exit code aggregation matches FR-010.

## Assumptions

- Aspect registry order is `code` then `deps`.
- Default aspects are `[code]` when not overridden.
- Flag and config names come from features `001` / `002` (not redefined here).

## Open questions

- Document any git porcelain differences if invocations cannot match the intended selection exactly (prefer `git` CLI; record deliberate differences in `specs/global/compatibility.md` if unavoidable).

## References

- Related: `006-secure-coding-rules`, `008-deps-extractors`, `009-deps-scanning`
- Global: [`architecture.md`](../../global/architecture.md)
