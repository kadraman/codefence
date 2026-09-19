# Tasks: Scan Orchestrator

**Input**: [spec.md](spec.md), [plan.md](plan.md)

**Format**: `- [ ] Tnnn [P?] [USn?] Description` with **exact repo paths**.

- **[P]**: can run in parallel (different files, no shared-write dependency)
- **[USn]**: maps to a user story in spec.md

## Phase 0: Foundation (blocks stories)

- [ ] T001 Create `internal/scan/types.go` with `AspectID`, `ScanContext`, `ScanOptions`, `AspectOutcome` per [spec.md](spec.md)
- [ ] T002 [P] Create `internal/scan/registry.go` registering aspect IDs `code` and `deps` in that order
- [ ] T003 [P] Create `internal/git/changed.go` for staged vs unstaged/working-tree file lists via `git` CLI

**Checkpoint**: types, registry stub, and git helpers exist before runner work.

## Phase 1: User Story 1 — Resolve files and build ScanContext (P1)

- [ ] T010 [US1] Implement context build in `internal/scan/context.go`: cwd, `--paths` expansion + `explicitPaths`, git file list when no paths
- [ ] T011 [US1] Apply `git_ignored_prefixes` in `internal/scan/context.go` only when not `explicitPaths`
- [ ] T012 [US1] Implement tree-scope discovery in `internal/scan/deps/discover.go` (skip `node_modules`, `.git`, vendor-like heavy dirs)
- [ ] T013 [US1] Unit tests in `internal/scan/context_test.go` and `internal/scan/deps/discover_test.go`; temp git coverage in `internal/git/changed_test.go`

**Checkpoint**: context + discovery independently testable.

## Phase 2: User Story 2 — Resolve aspects including auto-deps (P1)

- [ ] T020 [US2] Implement `internal/scan/aspects.go` (`resolveAspects` / auto-deps after `--skip`, re-check `--skip deps`)
- [ ] T021 [US2] Table tests in `internal/scan/aspects_test.go` covering `only`, `skip deps` vs `skip code`, manifest present/absent, `--deps-scope tree`

**Checkpoint**: aspect matrix green; `--skip deps` never re-adds `deps`.

## Phase 3: User Story 3 — Run aspects and aggregate exit (P1)

- [ ] T030 [US3] Implement `internal/scan/runner.go` (`RunScan`): sequential aspects, exit aggregation (`failed` → `1`)
- [ ] T031 [US3] Status logging in `internal/scan/status.go`
- [ ] T032 [US3] Wire CLI/hooks/MCP call sites to `RunScan` in `internal/cli/`, `internal/hooks/`, `internal/mcp/` (thin callers only)
- [ ] T033 [US3] Runner tests in `internal/scan/runner_test.go` (ordering, aggregation, quiet/verbose)

**Checkpoint**: shared `RunScan` used by CLI and MCP paths.

## Polish

- [ ] T900 Update user-facing docs under `docs/` if scan orchestration is documented there
- [ ] T901 Move this folder to `specs/complete/005-scan-orchestrator/` and update `specs/STATUS.md` when shipped
