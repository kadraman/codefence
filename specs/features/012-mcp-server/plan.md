# Implementation Plan: MCP Server for AI Agent Queries

**Spec**: [spec.md](spec.md) | **Date**: 2026-09-19 | **Branch**: `feat/012-mcp-server`

## Summary

Implement `codefence mcp` as a stdio JSON-RPC MCP server in `internal/mcp` with the six v1 tools, Finding-shaped results, path confinement, scan mutex, static annotations, and an in-memory last-scan store. Prefer hand-rolled transport if an SDK would blow ~2 MiB binary impact.

## Technical context

- **Packages / surfaces**: `internal/mcp`, `cmd/codefence`, shared `internal/scan`, `internal/findings`, OSV client from `internal/scan/deps`
- **Language**: Go
- **Testing**: recorded JSON-RPC scripts; unit tests for filters, path escape, mutex; B6 bench
- **NFR**: B6 ≤ 80 ms p95 for start→`initialize`→`tools/list`; lazy init; reuse HTTP clients
- **Performance / constraints**: hand-rolled preferred over heavy MCP SDK; one scan at a time

## Constitution Check

GATE: must pass before implementation. Re-check after design changes.

- [ ] No invented CLI/config/rule/finding/MCP behavior — **tool names and input schemas fixed by this spec**
- [ ] Core contract impact identified — **new MCP surface; Finding-shaped JSON (not NDJSON); tool schemas are core**
- [ ] Required behavior preserved or deliberate difference documented — **MCP is a v1 surface (compatibility.md)**
- [ ] NFR / dependency budget impact assessed — **B6 + B7; prefer hand-rolled JSON-RPC**
- [ ] Security boundaries preserved — **cwd confinement; evidence only; coordinates-only OSV; stdio only in v1**
- [ ] Tests planned for new behavior

**Exceptions** (fill only if a principle cannot be met):

| Principle | Why needed | Simpler alternative rejected because |
|-----------|------------|-------------------------------------|
| | | |

## Project structure

```text
internal/mcp/                # stdio JSON-RPC loop, tool registry, session store, handlers
internal/mcp/*_test.go
cmd/codefence/               # mcp command entry
scripts/bench-startup.sh     # include B6 MCP path
testdata/mcp/                # JSON-RPC scripts + fixture repos
docs/                        # host config snippets (Cursor MCP example)
```

## Implementation

### Library / package changes

1. Stdio JSON-RPC loop; stderr logging; reject non-stdio transports in v1.
2. `initialize` / `tools/list` / `tools/call` with capability `{ "tools": {} }`.
3. In-memory last-scan store; only `scan` replaces it.
4. Handlers: `scan`, `get_findings`, `query_by_path`, `deps_lookup`, `get_status`, `list_rules` with JSON Schema validation matching this feature.
5. Path confinement relative to `--cwd`; scan mutex; static annotations table.
6. Finding-shaped results (feature `003`); wire `deps_lookup` to OSV client/cache (`009`).

### CLI changes

`codefence mcp [--cwd] [--transport stdio] [--log-level]` per feature `001`.

### MCP changes

This feature owns the entire MCP surface for v1.

### Config / env changes

Load config with same precedence as CLI relative to `--cwd` (feature `002`).

### Documentation updates

Host config snippets in the README / `docs/ai-assistants.md`; ensure `011` templates mention MCP tools.

## Testing strategy

### Unit tests

- Path escape rejection
- Finding filters for `get_findings` / `query_by_path` (counts match findings)
- Mutex rejects or serializes concurrent scans
- Annotation static map

### Integration / fixture tests

- Full initialize + list + scan on fixture repo
- `get_findings` without second git walk when cached in store
- `deps_lookup` against mock OSV
- stdout-only MCP messages (fuzz logs to stderr)

### NFR / manual

- B6: process start through `initialize` and `tools/list` ≤ 80 ms p95 in CI harness

## Migration and compatibility

Ship MCP alongside CLI in the same binary. Keep CLI guardrail loop for hosts without MCP. Document Cursor/Claude config snippets.

## Open implementation questions

1. Exact MCP protocol version string to negotiate first — resolve against Cursor/Claude hosts.
2. Queue vs reject semantics for overlapping `scan` — both allowed by spec; pick one and document in implementation notes without changing tool schemas.
