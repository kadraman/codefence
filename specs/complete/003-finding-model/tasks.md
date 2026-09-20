# Tasks: Finding Model and Severity

**Input**: [spec.md](spec.md), [plan.md](plan.md)

**Format**: `- [ ] Tnnn [P?] [USn?] Description` with **exact repo paths**.

- **[P]**: can run in parallel (different files, no shared-write dependency)
- **[USn]**: maps to a user story in spec.md

## Phase 0: Foundation (blocks stories)

- [x] T001 Create `internal/findings` package
- [x] T002 [P] Define severity and confidence enums in `internal/findings`

**Checkpoint**: foundation complete before user-story work.

## Phase 1: User Story 1 — Shared Finding type (P1)

- [x] T010 [US1] Implement `Finding` struct with JSON tags per schema table in `internal/findings`
- [x] T011 [US1] Export deps rule ID constant `vulnerable-dependency` in `internal/findings`
- [x] T012 [P] [US1] Unit test: marshal Finding camelCase tags (`filePath`, `packageName`, `cveId`, …) in `internal/findings`

**Checkpoint**: library Finding usable by scanners/MCP.

## Phase 2: User Story 2 — Severity mapping (P1)

- [x] T020 [US2] Implement YAML/Semgrep severity mapping helpers in `internal/findings`
- [x] T021 [US2] Implement entropy-only severity bands vs threshold `T` in `internal/findings`
- [x] T022 [P] [US2] Table-driven tests for severity mappings in `internal/findings`

**Checkpoint**: secret + deps can share helpers.

## Polish

- [x] T900 Note in docs/`specs` that CLI NDJSON is feature 004 (not Finding tags)
- [x] T901 Move this folder to `specs/complete/003-finding-model/` and update `specs/STATUS.md` when shipped
