# Tasks: Secret Engine

**Input**: [spec.md](spec.md), [plan.md](plan.md)

**Format**: `- [ ] Tnnn [P?] [USn?] Description` with **exact repo paths**.

- **[P]**: can run in parallel (different files, no shared-write dependency)
- **[USn]**: maps to a user story in spec.md

## Phase 0: Foundation (blocks stories)

- [ ] T001 Embed builtin pack from `rules/secret/builtin.yml` in `internal/scan/secret/embed.go` (preserve IDs + version meta)
- [ ] T002 [P] Implement Semgrep-subset parser in `internal/scan/secret/yaml_parser.go` (`pattern-regex`, `pattern`, `patterns`, `pattern-either`)
- [ ] T003 [P] Document supported fields list in `internal/scan/secret/SUPPORTED_YAML.md` (or adjacent comment block referenced by tests)

**Checkpoint**: embed + parser foundation before matcher/entropy.

## Phase 1: User Story 1 — Load and match Semgrep-subset YAML (P1)

- [ ] T010 [US1] Rule load pipeline in `internal/scan/secret/load.go` (builtin default on + `--secret-rules` paths)
- [ ] T011 [US1] Matcher in `internal/scan/secret/match.go` (compile regex once per process)
- [ ] T012 [US1] Actionable YAML parse errors in `internal/scan/secret/yaml_parser.go`
- [ ] T013 [US1] Fixtures under `testdata/secrets/` and tests in `internal/scan/secret/match_test.go`

**Checkpoint**: builtin fixtures detect known secrets.

## Phase 2: User Story 2 — Entropy, merge, and filters (P1)

- [ ] T020 [US2] Entropy analysis in `internal/scan/secret/entropy.go` (defaults threshold `4.2`, min length `12`, min confidence `low`)
- [ ] T021 [US2] Lockfile-noise / path-only registry URL skips in `internal/scan/secret/entropy.go`
- [ ] T022 [US2] Merge/dedup in `internal/scan/secret/merge.go` (`rule+entropy` when correlated)
- [ ] T023 [US2] Confidence filter in `internal/scan/secret/filter.go`
- [ ] T024 [US2] Tests in `internal/scan/secret/entropy_test.go`, `internal/scan/secret/merge_test.go`; fixtures under `testdata/secrets/`

**Checkpoint**: entropy + merge cases green.

## Phase 3: User Story 3 — Remote cache and performance (P2)

- [ ] T030 [US3] Remote fetch + checksum + TTL cache in `internal/scan/secret/remote.go` writing under `.codefence/cache/secret-rules/` (default TTL `24h`, `--secret-rules-refresh`)
- [ ] T031 [US3] Shared cache helpers in `internal/cache/` if needed by secrets
- [ ] T032 [US3] Lazy CLI load + MCP in-memory compiled set wiring from `internal/scan/code/` into `internal/scan/secret/`
- [ ] T033 [US3] Evidence truncation in `internal/scan/secret/evidence.go`
- [ ] T034 [US3] Cache/refresh tests in `internal/scan/secret/remote_test.go`

**Checkpoint**: remote integrity + lazy load verified.

## Polish

- [ ] T900 Update user-facing docs under `docs/` if secret packs/flags are documented
- [ ] T901 Move this folder to `specs/complete/007-secret-engine/` and update `specs/STATUS.md` when shipped
