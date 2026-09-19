# Tasks: MCP Server for AI Agent Queries

**Input**: [spec.md](spec.md), [plan.md](plan.md)

**Format**: `- [ ] Tnnn [P?] [USn?] Description` with **exact repo paths**.

- **[P]**: can run in parallel (different files, no shared-write dependency)
- **[USn]**: maps to a user story in spec.md

## Phase 0: Foundation (blocks stories)

- [ ] T001 Create `internal/mcp/` stdio JSON-RPC loop skeleton (`server.go`, stderr logger); reject non-stdio transports
- [ ] T002 [P] Register `mcp` command flags (`--cwd`, `--transport`, `--log-level`) in `internal/cli/` and `cmd/codefence/`
- [ ] T003 [P] Session store type for last scan results in `internal/mcp/store.go`

**Checkpoint**: foundation complete before user-story work.

## Phase 1: User Story 1 — Stdio lifecycle (P1)

- [ ] T010 [US1] Implement `initialize` + capabilities `{ "tools": {} }` and `tools/list` in `internal/mcp/protocol.go`
- [ ] T011 [US1] Ensure stdout is MCP-only; integration script under `testdata/mcp/initialize_list.jsonl` + `internal/mcp/protocol_test.go`
- [ ] T012 [US1] Wire B6 measurement into `scripts/bench-startup.sh` (start → initialize → tools/list)

**Checkpoint**: initialize/list works without scan.

## Phase 2: User Story 2 — `scan` + store (P1)

- [ ] T020 [US2] `internal/mcp/tools_scan.go` — input schema validation; call `internal/scan` with staged/paths/only/skip/depsScope/secretMinConfidence/refreshDeps
- [ ] T021 [US2] Replace in-memory store on scan; return `ok`, `exitCode`, `aspects`, Finding-shaped `findings`, `findingCount`, `durationMs`
- [ ] T022 [US2] Fixture integration test in `internal/mcp/tools_scan_test.go` using `testdata/mcp/fixture-repo/`

**Checkpoint**: scan replaces store; Finding-shaped results.

## Phase 3: User Story 3 — Query tools (P1)

- [ ] T030 [P] [US3] `internal/mcp/tools_get_findings.go` — filters, limit/offset, empty-store behavior, `fromCache`
- [ ] T031 [P] [US3] `internal/mcp/tools_query_by_path.go` — path/prefix filter; `countsBySeverity` / `countsByKind` equal findings
- [ ] T032 [US3] Unit tests in `internal/mcp/tools_query_test.go`

## Phase 4: User Story 4 — Supporting tools (P2)

- [ ] T040 [P] [US4] `internal/mcp/tools_deps_lookup.go` — packages 1–100; reuse `internal/scan/deps` client/cache; mock OSV test
- [ ] T041 [P] [US4] `internal/mcp/tools_get_status.go` — version, cwd, config loaded, last scan timestamp, aspect defaults, readiness
- [ ] T042 [P] [US4] `internal/mcp/tools_list_rules.go` — secret + secure-coding rule IDs; `includePatterns` default false (no full regex bodies)

## Phase 5: User Story 5 — Annotations, errors, security (P1)

- [ ] T050 [US5] Static annotations table in `internal/mcp/annotations.go` (scan mutating; others read-only/idempotent)
- [ ] T051 [US5] Path confinement helpers in `internal/mcp/paths.go` + escape rejection tests
- [ ] T052 [US5] Scan mutex in `internal/mcp/mutex.go` (queue or reject overlapping scan with clear error) + tests
- [ ] T053 [US5] Error mapping: JSON-RPC for bad args; `isError: true` + retryable hint for provider timeouts in `internal/mcp/errors.go`

## Polish

- [ ] T900 Document host MCP config snippets in the README and/or `docs/ai-assistants.md`; ensure `011` templates mention tools
- [ ] T901 Move this folder to `specs/complete/012-mcp-server/` and update `specs/STATUS.md` when shipped
