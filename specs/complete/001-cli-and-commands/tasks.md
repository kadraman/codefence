# Tasks: CLI and Commands

**Input**: [spec.md](spec.md), [plan.md](plan.md)

**Format**: `- [ ] Tnnn [P?] [USn?] Description` with **exact repo paths**.

- **[P]**: can run in parallel (different files, no shared-write dependency)
- **[USn]**: maps to a user story in spec.md

## Phase 0: Foundation (blocks stories)

- [x] T001 Create `cmd/codefence/main.go` thin entry that delegates to `internal/cli`
- [x] T002 Create `internal/cli` package skeleton: command registry, root dispatch, shared exit helpers (exit 0 / 1 / 2)
- [x] T003 [P] Implement minimal argv parser in `internal/cli` supporting `--flag`, `--flag=value`, and multi-value `--paths`

**Checkpoint**: foundation complete before user-story work.

## Phase 1: User Story 1 — Run a scan with parity flags (P1)

- [x] T010 [US1] Define `scan` flags in `internal/cli` per FR-002 (aspects, format, quiet/verbose, deps-*, secret-*)
- [x] T011 [US1] Implement duration parsing (`24h` / `30m` / `15s`) in `internal/cli`
- [x] T012 [US1] Wire `scan` dispatch from `internal/cli` to scan library entry (stub ok until feature 005)
- [x] T013 [US1] Register `pre-commit` as equivalent to `scan --staged` in `internal/cli`
- [x] T014 [P] [US1] Table-driven parse tests in `internal/cli` for every scan flag happy path

**Checkpoint**: `codefence scan --staged --only deps` parses and dispatches.

## Phase 2: User Story 2 — Help and usage errors (P1)

- [x] T020 [US2] Implement `-h` / `--help` for root and all subcommands in `internal/cli`
- [x] T021 [US2] Scan help text: aspects, ignored path prefixes note, env var mirror list in `internal/cli`
- [x] T022 [US2] Unknown command / unknown flag → usage + exit 2 in `internal/cli`
- [x] T023 [P] [US2] Help golden tests under `testdata/cli/` (allow version line drift)
- [x] T024 [P] [US2] Parse error-path tests in `internal/cli` (exit 2)

**Checkpoint**: help exit 0; bad argv exit 2.

## Phase 3: User Story 3 — MCP and utility commands (P1)

- [x] T030 [US3] Register `mcp` with `--cwd`, `--transport stdio`, `--log-level` in `internal/cli`; reject non-stdio transport
- [x] T031 [US3] Implement `version` in `internal/cli` / `cmd/codefence` (version/commit)
- [x] T032 [US3] Implement `check-deps` redirect message to `scan` in `internal/cli`
- [x] T033 [US3] Register `install`, `install-hooks`, `background-scan`, `scan-worker` command stubs with `--dry-run` where specified in `internal/cli`
- [x] T034 [P] [US3] Tests for mcp flag rejection, version, and check-deps redirect in `internal/cli`

**Checkpoint**: all FR-001 commands registered.

## Polish

- [x] T900 Update user-facing docs under `docs/` with CLI examples if required
- [x] T901 Move this folder to `specs/complete/001-cli-and-commands/` and update `specs/STATUS.md` when shipped
