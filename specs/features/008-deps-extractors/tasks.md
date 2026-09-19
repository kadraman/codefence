# Tasks: Deps Extractors

**Input**: [spec.md](spec.md), [plan.md](plan.md)

**Format**: `- [ ] Tnnn [P?] [USn?] Description` with **exact repo paths**.

- **[P]**: can run in parallel (different files, no shared-write dependency)
- **[USn]**: maps to a user story in spec.md

## Phase 0: Foundation (blocks stories)

- [ ] T001 Create coordinate types and shared helpers in `internal/scan/deps/extract/types.go` (ecosystem, name, version)
- [ ] T002 Implement `MAX_LOCKFILE_BYTES = 10 MiB` reader + warning in `internal/scan/deps/extract/size.go`
- [ ] T003 [P] Implement basename/extension dispatch in `internal/scan/deps/extract/dispatch.go` (MVP manifests only)

**Checkpoint**: dispatch + size cap shared before per-ecosystem parsers.

## Phase 1: User Story 1 — Trigger vs extraction (P1)

- [ ] T010 [US1] Document/encode trigger-only vs extract paths in `internal/scan/deps/extract/triggers.go` (`go.sum` trigger-only)
- [ ] T011 [US1] Tests in `internal/scan/deps/extract/triggers_test.go`

**Checkpoint**: trigger classification independently testable.

## Phase 2: User Story 2 — MVP ecosystem matrix (P1)

- [ ] T020 [P] [US2] Node / JS-TS (`npm`) extractors in `internal/scan/deps/extract/node.go` (`package.json` exact pins, `package-lock.json` v2/v3, Classic `yarn.lock`, `pnpm-lock.yaml`; prefer pnpm → npm → yarn; Yarn Berry warn/empty)
- [ ] T021 [P] [US2] Go (`Go`) in `internal/scan/deps/extract/golang.go` (`go.mod` extract; `go.sum` trigger-only)
- [ ] T022 [US2] Shared range-skip + lock-on-disk warning in `internal/scan/deps/extract/merge.go`
- [ ] T023 [US2] Table tests for npm + Go under `internal/scan/deps/extract/*_test.go`; fixtures + golden JSON under `testdata/deps/`

**Checkpoint**: MVP matrix + precedence tests green.

## Phase 3: User Story 3 — Size cap and dispatch (P1)

- [ ] T040 [US3] Size-cap warning tests in `internal/scan/deps/extract/size_test.go` (file under `testdata/deps/` or generated temp > 10 MiB)
- [ ] T041 [US3] Dispatch coverage tests in `internal/scan/deps/extract/dispatch_test.go` (MVP only; roadmap manifests do not extract)
- [ ] T042 [US3] Confirm discovery skip-dir behavior remains with `internal/scan/deps/discover.go` (feature `005`)

**Checkpoint**: cap + dispatch acceptance complete.

## Polish

- [ ] T900 Update `docs/dependency-support.md` for MVP vs post-MVP roadmap
- [ ] T901 Move this folder to `specs/complete/008-deps-extractors/` and update `specs/STATUS.md` when shipped

## Out of scope (post-MVP — separate feature slices)

Do **not** implement in this feature: Python, Rust, Ruby, PHP, JVM, .NET, Swift (see roadmap table in `spec.md`).
