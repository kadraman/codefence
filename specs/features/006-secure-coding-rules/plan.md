# Implementation Plan: Secure-Coding Rules

**Spec**: [spec.md](spec.md) | **Date**: 2026-09-19 | **Branch**: `feat/006-secure-coding-rules`

## Summary

Hardcode the three v1 secure-coding rules as compiled regex in Go under `internal/rules`, wire them into the `code` aspect under `internal/scan/code`, and fail the aspect on any finding. No YAML secure-coding rules in v1.

## Technical context

- **Packages / surfaces**: `internal/rules`, `internal/scan/code`; findings via `internal/findings`
- **Language**: Go
- **Testing**: `go test ./...`; fixtures under `testdata/code/`
- **NFR**: no new direct dependencies; regex compile once per process where practical
- **Performance / constraints**: line-oriented scan; optional window API reserved

## Constitution Check

GATE: must pass before implementation. Re-check after design changes.

- [ ] No invented CLI/config/rule/finding/MCP behavior — only the three built-in rule IDs
- [ ] Core contract impact identified — secure-coding rule IDs are core (constitution § III)
- [ ] Required behavior preserved or deliberate difference documented in spec + compatibility.md
- [ ] NFR / dependency budget impact assessed — stdlib regex only
- [ ] Security boundaries preserved — evidence snippets only as Finding allows; no network
- [ ] Tests planned for new behavior — per-rule unit + `testdata/code/` fixtures

**Exceptions** (fill only if a principle cannot be met):

| Principle | Why needed | Simpler alternative rejected because |
|-----------|------------|-------------------------------------|
| | | |

## Project structure

```text
internal/rules/          # no-eval, no-shell-true, no-insecure-http
internal/scan/code/      # code aspect: secure-coding + secret wiring
testdata/code/           # positive/negative fixtures
```

## Implementation

### Library / package changes

1. Implement three compiled-regex rules with exact IDs and severities.
2. File filtering for scannable extensions / ignore logic.
3. Reserve windowed-rule API (`windowSize`) for future rules.
4. Wire into `code` aspect before/with secrets.

### CLI changes

None dedicated; aspect flags from feature `001`.

### MCP changes

None dedicated; findings flow through shared scan + finding model.

### Config / env changes

None new for secure-coding rules in v1.

### Documentation updates

Agent/docs that list rule IDs if present under `docs/`; do not rename IDs.

## Testing strategy

### Unit tests

- Positive/negative lines per rule in `internal/rules/*_test.go`.

### Integration / fixture tests

- Fixtures under `testdata/code/` exercised via `code` aspect.

### NFR / manual

- Confirm no dependency budget impact.

## Migration and compatibility

Preserve rule IDs and severities. Do not rename without migration (compatibility.md).

## Open implementation questions

- Exact ignore-path list and scannable extensions: follow this feature’s filter requirements; do not invent.
