---
title: "MCP Server for AI Agent Queries"
id: 12
slug: "mcp-server"
status: specified
authors: ["@kadraman"]
created: 2026-09-19
updated: 2026-09-19
issue: "https://github.com/kadraman/codefence/issues/12"
area: mcp
---

# Feature Specification: MCP Server for AI Agent Queries

## Summary

Add `codefence mcp`: a Model Context Protocol server (stdio transport) that exposes security-scan tools so AI agents can invoke structured operations (`scan`, `get_findings`, `query_by_path`, `deps_lookup`, `get_status`, `list_rules`) without shelling out to the CLI for every query. The server reuses the same scan library as the CLI and returns Finding-shaped JSON (not CLI NDJSON).

## Problem

Agent loops that repeatedly spawn `codefence scan` pay process startup and must parse human/NDJSON text from a shell. MCP provides discoverable tools with JSON schemas, long-lived process reuse (amortizes startup), and safer structured results for tool-calling models.

## User scenarios

### User Story 1 — Stdio MCP server lifecycle (Priority: P1)

**Why this priority**: Transport and process model are prerequisites for all tools.

**Independent test**: JSON-RPC script: `initialize` → `tools/list` → tool call; logs only on stderr; stdout is valid MCP messages only.

**Acceptance scenarios**:

1. **Given** `codefence mcp` (optionally `--cwd <repo>`, `--log-level`), **When** the process starts, **Then** it speaks MCP over **stdio** (newline-delimited JSON-RPC 2.0 on stdin/stdout) with logs on **stderr only**.
2. **Given** v1, **When** a non-stdio transport is requested, **Then** it is rejected with a clear error (Streamable HTTP is not in v1).
3. **Given** `initialize`, **When** capabilities are declared, **Then** the server advertises `{ "tools": {} }` (`listChanged` optional false for v1).
4. **Given** protocol alignment, **When** negotiating, **Then** MCP **2024-11-05** is the minimum; prefer compatibility with **2025-06-18** tools shape (`name`, `description`, `inputSchema`, optional `outputSchema` / annotations).
5. **Given** `--cwd`, **When** tools run, **Then** that path is the repo root for config load and path confinement; default is process cwd.
6. **Given** process lifetime, **When** secret rules and HTTP clients are needed, **Then** they may persist for the process; compiled rules/clients are reused.

### User Story 2 — `scan` tool and in-memory store (Priority: P1)

**Why this priority**: Only `scan` mutates the last-result store; query tools depend on it.

**Independent test**: Fixture repo scan returns structured result with Finding-shaped `findings`; subsequent `get_findings` reads the store without a second scan.

**Acceptance scenarios**:

1. **Given** tool `scan` with optional `staged`, `paths`, `only`, `skip`, `depsScope`, `secretMinConfidence`, `refreshDeps`, **When** invoked, **Then** it runs a full guardrail scan with the same semantics as `codefence scan`.
2. **Given** `staged` omitted, **When** `scan` runs, **Then** default is `false` (unstaged/working-tree changes unless staged is true) — same as CLI.
3. **Given** `paths` is set, **When** discovering files, **Then** path scoping wins and `staged` is ignored for discovery (same as CLI `--paths`).
4. **Given** a successful `scan`, **When** the result is stored, **Then** the in-memory last-scan store is **replaced**; `ok` is false when any aspect failed; `findings` use the Finding model (feature `003`).
5. **Given** result shape, **When** returned, **Then** it includes `ok`, `exitCode`, `aspects`, `findings`, `findingCount`, `durationMs` (structured content + text summary).

### User Story 3 — Read-only query tools (Priority: P1)

**Why this priority**: Agents need filtered views without re-scanning.

**Independent test**: Empty store → empty findings; after scan → filters and path queries match store contents; counts equal returned findings.

**Acceptance scenarios**:

1. **Given** `get_findings` with optional `kind`, `severityMin`, `ruleId`, `limit` (default 100, max 500), `offset`, **When** called, **Then** it does **not** run a scan; filters the last store; empty store → `findings: []`, `total: 0`, `fromCache: false`; otherwise `fromCache: true`.
2. **Given** `query_by_path` with required `path` and optional `includeChildren` (default true), **When** called, **Then** it does **not** run a scan; returns findings for that path/prefix plus `countsBySeverity` / `countsByKind` that **must** equal the returned `findings`; empty store → empty findings and zero counts.
3. **Given** agents need a path-scoped refresh, **When** following guidance, **Then** they call `scan` with `"paths": ["…"]` first, then `query_by_path`.

### User Story 4 — `deps_lookup`, `get_status`, `list_rules` (Priority: P2)

**Why this priority**: Supporting tools complete the v1 required tool list without requiring a prior full scan for deps.

**Independent test**: `deps_lookup` against mock OSV; `get_status` returns health fields; `list_rules` summarizes IDs without full regex bodies by default.

**Acceptance scenarios**:

1. **Given** `deps_lookup` with `packages` (1–100 items of `ecosystem`/`name`/`version`) and optional `refresh`, **When** called, **Then** it queries via the OSV client + cache (feature `009`) and returns advisories / Finding-shaped objects per coordinate plus `cacheHits`.
2. **Given** `get_status`, **When** called, **Then** it returns server health: version, cwd, config loaded, last scan timestamp, aspect defaults, NFR-friendly readiness.
3. **Given** `list_rules` with optional `includePatterns` default false, **When** called, **Then** it summarizes active secret rule IDs + builtin secure-coding rule IDs without full regex bodies by default.

### User Story 5 — Annotations, errors, security (Priority: P1)

**Why this priority**: Constitution requires path confinement, honest read-only hints, and no file-content exfiltration.

**Independent test**: Absolute path escaping cwd is rejected; concurrent `scan` is mutex-serialized or rejected; stdout never receives non-MCP bytes.

**Acceptance scenarios**:

1. **Given** tool annotations (when protocol supports), **When** tools are registered, **Then** annotations are **static** per tool: only `scan` has `readOnlyHint: false`; query tools are `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`; `scan` has `idempotentHint: false`.
2. **Given** unknown tool or invalid args, **When** handled, **Then** JSON-RPC error is returned.
3. **Given** scan/provider failures, **When** returned as tool results, **Then** `isError: true` with message; include retryable hint for network timeouts.
4. **Given** any logging, **When** writing output, **Then** never write non-MCP bytes to stdout.
5. **Given** tool path arguments, **When** resolved, **Then** operate only on `--cwd` filesystem; reject absolute paths that escape cwd after clean/abs resolve.
6. **Given** findings, **When** returned, **Then** do not return full file contents — findings evidence only.
7. **Given** overlapping `scan` calls, **When** concurrency is limited, **Then** max concurrent scans = 1 (mutex); queue or reject with a clear error.
8. **Given** `deps_lookup`, **When** contacting OSV, **Then** only package coordinates are sent (not source bodies).

### Edge cases

- Empty git file set (no staged/unstaged changes): empty findings + warning on stderr (same as CLI), including when agents omit `staged` / `paths`.
- Exact MCP protocol version string to negotiate first — resolve during implementation against target hosts (open question).
- Out of scope v1: MCP resources/prompts beyond tools; codebase symbol index; remote multi-tenant MCP; stdio authentication.

## Requirements

### Functional requirements

- **FR-001**: System MUST provide `codefence mcp` with stdio transport; logs on stderr only; flags `--cwd`, `--transport stdio` (v1), `--log-level`.
- **FR-002**: System MUST register tools: `scan`, `get_findings`, `query_by_path`, `deps_lookup`, `get_status`, `list_rules` with JSON Schema inputs as specified in this feature's user scenarios.
- **FR-003**: `scan` MUST share scan semantics with the CLI library (`RunScan` / equivalent) and replace the in-memory last-scan store on success path as specified.
- **FR-004**: `get_findings` and `query_by_path` MUST be read-only views of the store and MUST NOT run a scan.
- **FR-005**: Results MUST be Finding-shaped (feature `003`), not CLI NDJSON wire keys (feature `004`).
- **FR-006**: System MUST enforce path confinement to `--cwd` and a scan mutex (one scan at a time).
- **FR-007**: System MUST apply static tool annotations as specified in User Story 5 when the protocol supports them.
- **FR-008**: System MUST validate inputs; unknown tool / invalid args → JSON-RPC error; scan/provider failures → `isError: true` tool results with retryable hint when appropriate.
- **FR-009**: MCP `initialize` + `tools/list` MUST meet NFR budget B6 (≤ 80 ms p95) per `specs/global/nfr.md`.
- **FR-010**: Prefer a hand-rolled stdio JSON-RPC loop in `internal/mcp` over a heavy SDK if binary impact would exceed ~2 MiB.

### Non-goals

- Streamable HTTP transport (future).
- MCP resources/prompts subscriptions beyond tools.
- General codebase symbol index / repo map.
- Remote multi-tenant MCP or stdio authentication.
- Returning full file contents to agents.

## Success criteria

- **SC-001**: Integration tests cover initialize + list + scan on a fixture repo.
- **SC-002**: `get_findings` returns prior scan without a second git walk when store is populated.
- **SC-003**: `deps_lookup` works against mock OSV; path escape and mutex unit tests pass.
- **SC-004**: stdout contains only valid MCP messages (logging fuzzed to stderr).
- **SC-005**: B6 bench (`initialize` + `tools/list`) is wired and green in CI.

## Assumptions

- Features `005` (orchestrator), `009` (OSV client), `003` (Finding), `001`/`002` (CLI/config) exist or land in dependency order.
- Install templates (feature `011`) mention MCP once this server exists.

## Open questions

1. Exact MCP protocol version string to negotiate first — resolve during implementation against target hosts (Cursor/Claude).
2. Empty git file set: document fallback to empty findings + warning on stderr (same as CLI), including when agents omit `staged` / `paths`.

## References

- Related: `001-cli-and-commands`, `003-finding-model`, `005-scan-orchestrator`, `009-deps-scanning`, `011-install-ai`, `global/nfr.md`, `global/compatibility.md`
- External: https://modelcontextprotocol.io/specification/2025-06-18/server/tools
