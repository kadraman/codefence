# Implementation Plan: Output Formats

**Spec**: [spec.md](spec.md) | **Date**: 2026-09-19 | **Branch**: `feat/004-output-formats`

## Summary

Implement `internal/output` with table and NDJSON writers, quiet/verbose routing, and an explicit Finding → wire mapper so CLI stdout never accidentally emits Finding camelCase tags. MCP continues to use Finding JSON from `internal/findings`.

## Technical context

- **Packages / surfaces**: `internal/output` (consumes `internal/findings`; used by `internal/cli` / `internal/scan`)
- **Language**: Go
- **Testing**: mapper unit tests; golden NDJSON under `testdata/`; quiet/verbose matrix; no-progress-on-stdout in JSON mode
- **NFR**: color/TTY detection via stdlib or tiny helper; avoid heavy UI libs
- **Performance / constraints**: streaming line writes; no buffering entire result sets beyond aspect needs

## Constitution Check

GATE: must pass before implementation. Re-check after design changes.

- [x] No invented CLI/config/rule/finding/MCP behavior — wire keys only from this spec
- [x] Core contract impact identified — CLI NDJSON wire shape is a core contract
- [x] Required destinations, quiet defaults, category `code`|`dependency` only
- [x] NFR / dependency budget impact assessed — no heavy terminal frameworks
- [x] Security boundaries preserved — evidence only as already on Finding
- [x] Tests planned — goldens, mapper, stream separation

**Exceptions**: none

## Project structure

```text
internal/output/        # table writer, NDJSON writer, Finding→wire mapper
testdata/output/        # golden NDJSON fixtures
```

## Implementation

### Library / package changes

- Wire DTO types (finding + warning) separate from `findings.Finding`.
- Mapper: Finding → wire (category from aspect, `fixed` / `location` transforms).
- Table renderer with TTY color degrade; optional deps aggregation.

### CLI changes

- `--format`, `--quiet`, `--verbose` already parsed in 001; writers honor them here.

### MCP changes

- None (Finding-shaped results only).

### Config / env changes

- `format` / quiet / verbose defaults from 002 merge.

### Documentation updates

- Document that CLI JSON ≠ Finding schema; link 003 vs 004.

## Testing strategy

### Unit tests

- Finding → wire for code, secret, and deps (category/kind/`fixed`/`location`).
- Warning object shape.

### Integration / fixture tests

- Golden NDJSON asserting wire keys.
- Assert no progress on stdout in JSON mode.
- Quiet/verbose matrix.

### NFR / manual

- Non-TTY table run (no color codes required).

## Migration and compatibility

- v1 default remains the NDJSON wire shape in this spec.
- Future Finding-shaped CLI JSON only behind versioned flag / `schemaVersion`.

## Open implementation questions

- Color library vs manual ANSI — prefer minimal approach under NFR allowlist.
