# Tasks: AI Assistant Install

**Input**: [spec.md](spec.md), [plan.md](plan.md)

**Format**: `- [ ] Tnnn [P?] [USn?] Description` with **exact repo paths**.

- **[P]**: can run in parallel (different files, no shared-write dependency)
- **[USn]**: maps to a user story in spec.md

## Phase 0: Foundation (blocks stories)

- [ ] T001 Create `internal/install/` package and register `install` / `--dry-run` in `internal/cli/` + `cmd/codefence/`
- [ ] T002 [P] Add `templates/ai/` directory and `go:embed` wiring in `internal/install/embed.go`

**Checkpoint**: foundation complete before user-story work.

## Phase 1: User Story 1 — Marker-based merge (P1)

- [ ] T010 [US1] Marker merge helpers in `internal/install/markers.go` (`<!-- codefence-guardrails:start -->` / `end`)
- [ ] T011 [US1] Writers for `AGENTS.md`, `.claude/CLAUDE.md`, `.github/copilot-instructions.md`, `.cursor/rules/codefence-guardrails.mdc` in `internal/install/targets.go`
- [ ] T012 [US1] Merge + idempotent + dry-run tests in `internal/install/install_test.go` (preserve outside-marker content)

**Checkpoint**: story independently testable.

## Phase 2: User Story 2 — `.gitignore` for `.codefence/` (P1)

- [ ] T020 [US2] Ensure `.codefence/` in `.gitignore` (create/append, no duplicate) in `internal/install/gitignore.go`
- [ ] T021 [US2] Tests in `internal/install/gitignore_test.go`

## Phase 3: User Story 3 — Templates for binary + MCP (P1)

- [ ] T030 [US3] Port/update template bodies under `templates/ai/*` (prefer `codefence scan --staged`; prefer MCP tools when configured; do not tell users to run scans unless binary missing)
- [ ] T031 [US3] Update user docs in `docs/ai-assistants.md`
- [ ] T032 [US3] Coordinate MCP tool name mentions with `specs/features/012-mcp-server/spec.md` (no invented tool names)

## Polish

- [ ] T900 Confirm marker stability called out in `specs/global/compatibility.md`
- [ ] T901 Move this folder to `specs/complete/011-install-ai/` and update `specs/STATUS.md` when shipped
