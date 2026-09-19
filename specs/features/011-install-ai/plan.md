# Implementation Plan: AI Assistant Install

**Spec**: [spec.md](spec.md) | **Date**: 2026-09-19 | **Branch**: `feat/011-install-ai`

## Summary

Implement `codefence install` with marker-based merges for AGENTS/Claude/Copilot/Cursor guardrails, `.gitignore` handling for `.codefence/`, and `go:embed` templates that mention the `codefence` binary and MCP tools.

## Technical context

- **Packages / surfaces**: `internal/install`, `templates/ai/*`, `cmd/codefence`, `internal/cli`
- **Language**: Go with `go:embed`
- **Testing**: merge/idempotency/dry-run tests under `internal/install`
- **NFR**: embed only required templates (do not embed example fixtures)
- **Performance / constraints**: N/A beyond embed size discipline

## Constitution Check

GATE: must pass before implementation. Re-check after design changes.

- [ ] No invented CLI/config/rule/finding/MCP behavior — **templates may mention MCP tools defined in `012` only**
- [ ] Core contract impact identified or N/A — **stable marker names are a compatibility contract**
- [ ] Required behavior preserved or deliberate difference documented — **marker names stable; content updated for binary + MCP**
- [ ] NFR / dependency budget impact assessed — **embed templates only**
- [ ] Security boundaries preserved or N/A
- [ ] Tests planned for new behavior

**Exceptions** (fill only if a principle cannot be met):

| Principle | Why needed | Simpler alternative rejected because |
|-----------|------------|-------------------------------------|
| | | |

## Project structure

```text
templates/ai/                # guardrail templates (go:embed)
internal/install/            # marker merge, gitignore, dry-run
internal/install/*_test.go
docs/ai-assistants.md
cmd/codefence/               # install command dispatch
```

## Implementation

### Library / package changes

1. Marker merge helpers for start/end comment markers.
2. Target writers for `AGENTS.md`, `.claude/CLAUDE.md`, `.github/copilot-instructions.md`, `.cursor/rules/codefence-guardrails.mdc`.
3. `.gitignore` ensure `.codefence/` present once.
4. Embed `templates/ai/*`; update copy for binary + MCP preference language from spec.

### CLI changes

`codefence install` and `--dry-run` per feature `001`.

### MCP changes

N/A for server; templates reference MCP tool names once `012` lands (coordinate text with that feature).

### Config / env changes

N/A.

### Documentation updates

Update `docs/ai-assistants.md` for binary + MCP.

## Testing strategy

### Unit tests

- Merge preserves outside-marker content
- Idempotent double install
- dry-run writes nothing
- `.gitignore` append-if-missing / no duplicate

### Integration / fixture tests

- Temp dirs simulating each assistant target path

### NFR / manual

- Confirm embedded template size remains modest

## Migration and compatibility

Stable markers allow re-install without duplication. Template body may mention binary + MCP but markers must not change (`compatibility.md`).

## Open implementation questions

1. Exact template file names under `templates/ai/*` — preserve names where possible; do not invent new marker schemes.
