# Implementation Plan: Config and Environment

**Spec**: [spec.md](spec.md) | **Date**: 2026-09-19 | **Branch**: `feat/002-config-and-env`

## Summary

Implement `internal/config` to load `codefence-config.yml` (schema version 1, cwd-only), parse `CODEFENCE_*` env vars, and merge with CLI flags supplied by `internal/cli`. Expose `.codefence/` cache path helpers for other packages.

## Technical context

- **Packages / surfaces**: `internal/config`, `internal/cache` (path helpers), consumed by `internal/cli` / `internal/scan` / `internal/mcp`
- **Language**: Go
- **Testing**: merge matrix unit tests; example file load; invalid YAML → exit 2 at CLI boundary
- **NFR**: one small YAML dependency justified in `specs/global/nfr.md`
- **Performance / constraints**: cwd-only load; no upward walk in v1

## Constitution Check

GATE: must pass before implementation. Re-check after design changes.

- [x] No invented CLI/config/rule/finding/MCP behavior — schema and env names from example only
- [x] Core contract impact identified — config schema v1 and `CODEFENCE_*` names are core contracts
- [x] Required behavior preserved — cwd-only load; exit 2 for config errors is deliberate v1 policy
- [x] NFR / dependency budget impact assessed — YAML parser must fit allowlist
- [x] Security boundaries preserved — config load does not network
- [x] Tests planned — merge matrix, invalid YAML, example file

**Exceptions**: none

## Project structure

```text
internal/config/        # YAML schema, env parse, merge
internal/cache/         # .codefence/cache path helpers (optional thin)
examples/codefence-config.yml.example
testdata/config/        # merge fixtures
```

## Implementation

### Library / package changes

- Define structs for version 1 schema in `internal/config`.
- Load YAML from cwd; return builtins when absent.
- Parse env mirrors; merge order flag > env > file > builtins.
- Export path constants for `.codefence/` local state.

### CLI changes

- `internal/cli` calls merge after flag parse (feature 001); config errors → exit 2.

### MCP changes

- MCP uses the same merge helpers for `--cwd` (feature 012).

### Config / env changes

- This feature owns the schema and env surface.

### Documentation updates

- Document env/config in the README; keep example file authoritative for keys.

## Testing strategy

### Unit tests

- Merge matrix (flag beats env beats file).
- Boolean env truthy set.
- Invalid YAML error.

### Integration / fixture tests

- Example file loads without error.
- CLI path: bad config → exit 2 (with 001).

### NFR / manual

- Confirm YAML dependency listed in NFR allowlist.

## Migration and compatibility

- Schema version 1 only; unsupported versions fail clearly.
- No upward walk in v1.

## Open implementation questions

- Whether path helpers live in `internal/cache` vs `internal/config` — prefer `internal/cache` per architecture layout.
