# Implementation Plan: <TITLE>

**Spec**: [spec.md](spec.md) | **Date**: YYYY-MM-DD | **Branch**: `feat/NNN-slug`

## Summary

Primary requirement and technical approach.

## Technical context

- **Packages / surfaces**: e.g. `cmd/codefence`, `internal/scan`, `internal/mcp`
- **Language**: Go (module in repo root)
- **Testing**: `go test ./...`, race on CI, fixtures under `testdata/`
- **NFR**: budgets in `specs/global/nfr.md` (or N/A)
- **Performance / constraints**: (or N/A)

## Constitution Check

GATE: must pass before implementation. Re-check after design changes.

- [ ] No invented CLI/config/rule/finding/MCP behavior
- [ ] Core contract impact identified (aspects, Finding/NDJSON, config, rule IDs) or N/A
- [ ] Public contracts preserved or deliberate difference documented in spec + compatibility.md
- [ ] NFR / dependency budget impact assessed
- [ ] Security boundaries preserved (path confinement, evidence, remote integrity)
- [ ] Tests planned for new behavior

**Exceptions** (fill only if a principle cannot be met):

| Principle | Why needed | Simpler alternative rejected because |
|-----------|------------|-------------------------------------|
| | | |

## Project structure

List directories and files this feature will add or change.

## Implementation

### Library / package changes

### CLI changes

### MCP changes

### Config / env changes

### Documentation updates

(`docs/`, `specs/global/` if contracts change)

## Testing strategy

### Unit tests

### Integration / fixture tests

### NFR / manual

## Migration and compatibility

## Open implementation questions
