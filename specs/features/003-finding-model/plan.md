# Implementation Plan: Finding Model and Severity

**Spec**: [spec.md](spec.md) | **Date**: 2026-09-19 | **Branch**: `feat/003-finding-model`

## Summary

Add `internal/findings` with the unified `Finding` type, severity/confidence enums, YAML/Semgrep and entropy severity helpers, and the `vulnerable-dependency` rule ID constant. Explicitly keep CLI NDJSON mapping in `internal/output` (feature 004).

## Technical context

- **Packages / surfaces**: `internal/findings` (consumed by `internal/scan/*`, `internal/output`, `internal/mcp`)
- **Language**: Go
- **Testing**: unit tests for severity mappings; JSON tag smoke tests
- **NFR**: tiny package; no new deps
- **Performance / constraints**: N/A

## Constitution Check

GATE: must pass before implementation. Re-check after design changes.

- [x] No invented CLI/config/rule/finding/MCP behavior — fields only from this schema table
- [x] Core contract impact identified — Finding schema is a core contract; CLI NDJSON remains separate (004)
- [x] Required Finding field names preserved; wire projection deferred to 004
- [x] NFR / dependency budget impact assessed — no new dependencies
- [x] Security boundaries preserved — evidence remains truncated/redacted as produced by scanners
- [x] Tests planned — severity helpers, rule ID constant, marshal tags

**Exceptions**: none

## Project structure

```text
internal/findings/      # Finding, severity, confidence, helpers
```

## Implementation

### Library / package changes

- `Finding` struct with JSON tags per FR-001/FR-002.
- Severity mapping helpers for secrets YAML and entropy bands.
- `const` / var for `vulnerable-dependency`.

### CLI changes

- None directly; CLI uses output mapper (004).

### MCP changes

- MCP tool results use Finding-shaped JSON (012 consumes this package).

### Config / env changes

- N/A

### Documentation updates

- Cross-link 003 vs 004 in architecture / compatibility if needed.

## Testing strategy

### Unit tests

- Severity table + entropy bands in `internal/findings`.
- Deps rule ID constant.

### Integration / fixture tests

- Golden CLI NDJSON owned by 004 (must not assert Finding field names on stdout).

### NFR / manual

- N/A

## Migration and compatibility

- Stable camelCase Finding names for library/MCP.
- Any future CLI rename to Finding-shaped NDJSON requires versioned migration in 004.

## Open implementation questions

- None.
