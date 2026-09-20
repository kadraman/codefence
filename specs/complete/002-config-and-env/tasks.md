# Tasks: Config and Environment

**Input**: [spec.md](spec.md), [plan.md](plan.md)

**Format**: `- [ ] Tnnn [P?] [USn?] Description` with **exact repo paths**.

- **[P]**: can run in parallel (different files, no shared-write dependency)
- **[USn]**: maps to a user story in spec.md

## Phase 0: Foundation (blocks stories)

- [x] T001 Create `internal/config` package with version-1 schema structs (`scan`, `paths`, `deps`, `secret`)
- [x] T002 [P] Add builtins defaults in `internal/config` matching example defaults
- [x] T003 [P] Add `.codefence/` path constants in `internal/cache` (or `internal/config` if cache package deferred)

**Checkpoint**: foundation complete before user-story work.

## Phase 1: User Story 1 — Load repo defaults from cwd (P1)

- [x] T010 [US1] Implement cwd-only YAML load of `codefence-config.yml` in `internal/config` (no upward walk)
- [x] T011 [US1] Reject invalid YAML / unsupported `version` with clear errors in `internal/config`
- [x] T012 [P] [US1] Test: load `examples/codefence-config.yml.example` without error
- [x] T013 [P] [US1] Test: missing file → builtins only in `internal/config`

**Checkpoint**: valid example loads; bad YAML errors.

## Phase 2: User Story 2 — Env and precedence merge (P1)

- [x] T020 [US2] Parse `CODEFENCE_*` env mirrors in `internal/config` (aspects/only/skip/format/quiet/verbose/git prefixes/deps/secret)
- [x] T021 [US2] Boolean env truthy parsing (`1|true|on|yes`) in `internal/config`
- [x] T022 [US2] Implement merge: CLI flags > env > file > builtins in `internal/config`
- [x] T023 [US2] Wire `internal/cli` to call merge after flag parse; config errors → exit 2
- [x] T024 [P] [US2] Merge matrix unit tests in `internal/config`

**Checkpoint**: precedence proven by tests.

## Phase 3: User Story 3 — Local state paths (P2)

- [x] T030 [US3] Document/export paths: `.codefence/cache/code/`, `deps/`, `secret-rules/`, `.codefence/debounce.json` in `internal/cache`
- [x] T031 [US3] Coordinate with install: ensure `.codefence/` gitignored (hook in `internal/install` when that feature lands)

**Checkpoint**: path contract usable by scan packages.

## Polish

- [x] T900 Document config/env in the README / `docs/` as required
- [x] T901 Move this folder to `specs/complete/002-config-and-env/` and update `specs/STATUS.md` when shipped
