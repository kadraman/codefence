# Tasks: Secure-Coding Rules

**Input**: [spec.md](spec.md), [plan.md](plan.md)

**Format**: `- [ ] Tnnn [P?] [USn?] Description` with **exact repo paths**.

- **[P]**: can run in parallel (different files, no shared-write dependency)
- **[USn]**: maps to a user story in spec.md

## Phase 0: Foundation (blocks stories)

- [ ] T001 Create rule interface / registry in `internal/rules/rules.go` (line match + optional `windowSize`)
- [ ] T002 [P] Create scannable-file filter in `internal/scan/code/filter.go`

**Checkpoint**: rule API and filter ready before rule bodies.

## Phase 1: User Story 1 — Built-in line rules (P1)

- [ ] T010 [P] [US1] Implement `no-eval` in `internal/rules/no_eval.go` (severity high; `\beval\s*\(` / `\bnew\s+Function\s*\(`)
- [ ] T011 [P] [US1] Implement `no-shell-true` in `internal/rules/no_shell_true.go` (severity medium; `shell\s*:\s*true`)
- [ ] T012 [P] [US1] Implement `no-insecure-http` in `internal/rules/no_insecure_http.go` (severity medium; `http://` excluding localhost/127.0.0.1)
- [ ] T013 [US1] Unit tests in `internal/rules/no_eval_test.go`, `internal/rules/no_shell_true_test.go`, `internal/rules/no_insecure_http_test.go`
- [ ] T014 [US1] Fixtures under `testdata/code/` for positive/negative cases

**Checkpoint**: three rules independently testable with identical IDs/severities.

## Phase 2: User Story 2 — File filtering and scan loop (P1)

- [ ] T020 [US2] Implement line/window scan loop in `internal/scan/code/runner.go` emitting `Finding` with `kind: code`
- [ ] T021 [US2] Fail `code` aspect (exit 1) on any secure-coding finding in `internal/scan/code/runner.go`
- [ ] T022 [US2] Wire secure-coding into `code` aspect registry path in `internal/scan/` (before/with secrets)
- [ ] T023 [US2] Integration tests in `internal/scan/code/runner_test.go` using `testdata/code/`

**Checkpoint**: `code` aspect fails on fixtures that violate rules.

## Polish

- [ ] T900 Update user-facing docs under `docs/` if rule IDs are listed
- [ ] T901 Move this folder to `specs/complete/006-secure-coding-rules/` and update `specs/STATUS.md` when shipped
