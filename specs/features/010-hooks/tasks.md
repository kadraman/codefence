# Tasks: Hooks and Background Scanning

**Input**: [spec.md](spec.md), [plan.md](plan.md)

**Format**: `- [ ] Tnnn [P?] [USn?] Description` with **exact repo paths**.

- **[P]**: can run in parallel (different files, no shared-write dependency)
- **[USn]**: maps to a user story in spec.md

## Phase 0: Foundation (blocks stories)

- [ ] T001 Create `internal/hooks/` package with command entrypoints stubbed to shared scan API in `internal/scan/`
- [ ] T002 [P] Register `pre-commit`, `background-scan`, `scan-worker`, `install-hooks` in `internal/cli/` and `cmd/codefence/`

**Checkpoint**: foundation complete before user-story work.

## Phase 1: User Story 1 — Pre-commit (P1)

- [ ] T010 [US1] Implement `internal/hooks/precommit.go` calling staged scan (`scan --staged` semantics)
- [ ] T011 [US1] Integration test with temp git repo in `internal/hooks/precommit_test.go` (failing scan → non-zero exit)

**Checkpoint**: story independently testable.

## Phase 2: User Story 2 — Background scan, worker, debounce (P1)

- [ ] T020 [US2] Debounce logic + `.codefence/debounce.json` persistence in `internal/hooks/debounce.go` (default 2s; fake-clock tests in `internal/hooks/debounce_test.go`)
- [ ] T021 [US2] `internal/hooks/background.go` — accept `--file`, stdin JSON (`file_path`), env; spawn worker
- [ ] T022 [US2] `internal/hooks/worker.go` — scan target; write per-file findings to `.codefence/cache/code/` (use `internal/cache/` helpers as needed)
- [ ] T023 [US2] Tests in `internal/hooks/background_test.go` and `internal/hooks/worker_test.go`

**Checkpoint**: debounce + cache paths stable.

## Phase 3: User Story 3 — Install hooks (binary on PATH) (P1)

- [ ] T030 [US3] `internal/hooks/install.go` — write `.git/hooks/pre-commit` invoking `codefence pre-commit` (PATH); create `.cursor/hooks.json` / `.kiro/hooks.json` if missing (never overwrite); `--dry-run`
- [ ] T031 [US3] Tests in `internal/hooks/install_test.go` (dry-run no writes; hooks.json idempotent non-overwrite)
- [ ] T032 [US3] Update hooks documentation in `docs/hooks.md` (binary PATH / absolute path)

## Polish

- [ ] T900 Confirm `specs/global/compatibility.md` still lists binary-on-PATH hooks policy
- [ ] T901 Move this folder to `specs/complete/010-hooks/` and update `specs/STATUS.md` when shipped
