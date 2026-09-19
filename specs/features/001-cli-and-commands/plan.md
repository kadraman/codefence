# Implementation Plan: CLI and Commands

**Spec**: [spec.md](spec.md) | **Date**: 2026-09-19 | **Branch**: `feat/001-cli-and-commands`

## Summary

Thin `cmd/codefence` entry plus `internal/cli` for argv parsing, command dispatch, and help. Prefer a minimal hand-rolled parser for size; wire each command to existing/planned library packages without owning scan/MCP/install logic.

## Technical context

- **Packages / surfaces**: `cmd/codefence`, `internal/cli`
- **Language**: Go (module in repo root)
- **Testing**: `go test ./...`, table-driven parse tests, help goldens under `testdata/`
- **NFR**: help/version MUST stay lazy (see `specs/global/nfr.md`); avoid heavy CLI frameworks
- **Performance / constraints**: prefer stdlib / tiny parser over frameworks (Constitution V)

## Constitution Check

GATE: must pass before implementation. Re-check after design changes.

- [x] No invented CLI/config/rule/finding/MCP behavior — commands and flags taken only from this spec
- [x] Core contract impact identified — CLI surface and exit code 2 for usage errors; precedence shared with config
- [x] Required behavior preserved or deliberate difference documented — exit 2 for usage/config errors documented in spec + `global/compatibility.md`
- [x] NFR / dependency budget impact assessed — no heavy CLI framework; hand-rolled or stdlib-friendly parser
- [x] Security boundaries preserved — CLI does not exfiltrate beyond wired library calls
- [x] Tests planned for new behavior — parse tests, help goldens, exit-code checks

**Exceptions**: none

## Project structure

```text
cmd/codefence/          # main
internal/cli/           # argv parser, dispatch, help text
testdata/cli/           # help goldens, parse fixtures (as needed)
```

## Implementation

### Library / package changes

- `internal/cli`: command table, flag definitions, duration parsing, precedence application entry that consumes merged config from `internal/config` (feature 002).

### CLI changes

- Register all commands in FR-001; implement `version` print and `check-deps` redirect.
- Support `--flag=value` and multi `--paths` semantics.
- Exit 2 on usage/flag/unknown-command errors; exit 0 on help.

### MCP changes

- Register `mcp` command only; server implementation is feature 012.

### Config / env changes

- Apply precedence CLI > env > file > builtins when building scan options (file/env load in 002).

### Documentation updates

- Keep README examples aligned with spec examples when CLI ships.

## Testing strategy

### Unit tests

- Table-driven parse tests for every flag and error path in `internal/cli`.
- Duration parsing cases (`24h`, `30m`, `15s`, invalid).

### Integration / fixture tests

- `scan --help` exit 0; unknown flag exit 2.
- Golden help output (allow version line drift).

### NFR / manual

- Confirm help/version paths do not pull scan engines (lazy-init).

## Migration and compatibility

- Stable CLI surface; documented exit 2 for usage errors.
- `check-deps` remains a redirect, not a restored command.

## Open implementation questions

- Hand-rolled argv parser vs minimal stdlib-friendly library — choose for size under NFR allowlist.
