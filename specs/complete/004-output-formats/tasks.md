# Tasks: Output Formats

**Input**: [spec.md](spec.md), [plan.md](plan.md)

**Format**: `- [ ] Tnnn [P?] [USn?] Description` with **exact repo paths**.

- **[P]**: can run in parallel (different files, no shared-write dependency)
- **[USn]**: maps to a user story in spec.md

## Phase 0: Foundation (blocks stories)

- [x] T001 Create `internal/output` package
- [x] T002 [P] Define wire DTOs (finding + warning) in `internal/output` separate from `internal/findings.Finding`

**Checkpoint**: foundation complete before user-story work.

## Phase 1: User Story 1 — Stream destinations and quiet/verbose (P1)

- [x] T010 [US1] Implement table writer (findings → stderr; progress → stdout) in `internal/output`
- [x] T011 [US1] Implement NDJSON writer (findings → stdout; progress → stderr) in `internal/output`
- [x] T012 [US1] Honor quiet defaults for json / `--quiet` / `--verbose` in `internal/output`
- [x] T013 [US1] TTY color degrade for tables in `internal/output`
- [x] T014 [P] [US1] Tests: no progress on stdout in JSON mode; quiet/verbose matrix in `internal/output`

**Checkpoint**: stream routing matches FR-001/FR-002.

## Phase 2: User Story 2 — NDJSON wire contract and mapper (P1)

- [x] T020 [US2] Implement Finding → wire mapper in `internal/output` (`fixed`, `location`, category `code`\|`dependency` only)
- [x] T021 [US2] Ensure secret findings map to `category: "code"` + `kind: "secret"` in `internal/output`
- [x] T022 [US2] Implement warning NDJSON objects in `internal/output`
- [x] T023 [US2] Optional deps table aggregation per `package@version` in `internal/output`
- [x] T024 [P] [US2] Mapper unit tests (code/deps/secret) in `internal/output`
- [x] T025 [P] [US2] Golden NDJSON fixtures under `testdata/output/` asserting wire keys (`filename`, `location`, `package`, `version`, `fixed`, `cve`)

**Checkpoint**: wire contract locked by tests; Finding tags never on CLI stdout.

## Polish

- [x] T900 Document CLI JSON vs Finding schema in `docs/` / README as required
- [x] T901 Move this folder to `specs/complete/004-output-formats/` and update `specs/STATUS.md` when shipped
