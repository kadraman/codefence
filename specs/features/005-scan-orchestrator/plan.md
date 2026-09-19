# Implementation Plan: Scan Orchestrator

**Spec**: [spec.md](spec.md) | **Date**: 2026-09-19 | **Branch**: `feat/005-scan-orchestrator`

## Summary

Implement scan runner semantics in `internal/scan` with git file selection in `internal/git` and tree-scope manifest discovery under `internal/scan/deps`. Expose one `RunScan` for CLI and MCP. No new flags or aspect IDs.

## Technical context

- **Packages / surfaces**: `internal/scan`, `internal/git`, `internal/scan/deps` (manifest discovery for tree scope); callers in `internal/cli`, `internal/hooks`, `internal/mcp`
- **Language**: Go (module in repo root)
- **Testing**: `go test ./...`, race on CI, fixtures under `testdata/`
- **NFR**: budgets in `specs/global/nfr.md` — empty staged scan B4; lazy init (no unnecessary walks on `version`/`--help`)
- **Performance / constraints**: Prefer `git` CLI for fidelity; sequential aspect execution (no parallel aspects in v1)

## Constitution Check

GATE: must pass before implementation. Re-check after design changes.

- [ ] No invented CLI/config/rule/finding/MCP behavior
- [ ] Core contract impact identified (aspects, Finding/NDJSON, config, rule IDs) — aspect model + `RunScan` shared API
- [ ] Required behavior preserved or deliberate difference documented in spec + compatibility.md
- [ ] NFR / dependency budget impact assessed — should add no new direct deps; git via CLI
- [ ] Security boundaries preserved (path confinement, evidence, remote integrity) — N/A for remote; cwd-scoped paths
- [ ] Tests planned for new behavior — aspect matrix, git temp repos, tree discovery skips

**Exceptions** (fill only if a principle cannot be met):

| Principle | Why needed | Simpler alternative rejected because |
|-----------|------------|-------------------------------------|
| | | |

## Project structure

```text
internal/scan/           # runner, types, aspect registry, RunScan
internal/git/            # staged / unstaged changed files
internal/scan/deps/      # tree-scope manifest discovery for --deps-scope tree
internal/scan/*_test.go
internal/git/*_test.go
testdata/scan/           # optional fixtures for scoping / discovery
```

## Implementation

### Library / package changes

1. Implement `ScanOptions` / `ScanContext` construction (cwd, files, staged, explicitPaths, deps manifest paths).
2. Implement aspect resolution including auto-deps; MUST honor `--skip deps` so auto-add cannot re-include a skipped aspect.
3. Register `code` and `deps` aspects; run sequentially in registry order.
4. Aggregate outcomes: any `failed` → exit `1`.
5. Status logging for quiet/verbose/format.

### CLI changes

No new flags. `codefence scan` (and related entrypoints) call `RunScan`. Flags owned by feature `001`.

### MCP changes

MCP `scan` tool calls the same `RunScan` (feature `012` wires the tool; this feature owns scan semantics).

### Config / env changes

Consume `git_ignored_prefixes` and default aspects from config/env (feature `002`); do not invent new keys.

### Documentation updates

User-facing scan semantics if `docs/` documents orchestration; keep `specs/global/architecture.md` aspect model authoritative.

## Testing strategy

### Unit tests

- Aspect resolution matrix: `only`, `skip deps` vs `skip code`, manifest present/absent, tree scope; assert `--skip deps` never yields `deps` after auto-add.
- Prefix filtering applies only when not `explicitPaths`.

### Integration / fixture tests

- Temp git repos for staged/unstaged selection.
- Tree discovery skips `node_modules`.

### NFR / manual

- Empty `scan --staged` remains within B4 when wired; do not load secret/deps engines until aspects run.

## Migration and compatibility

Required staged/unstaged and aspect behavior. Document any unavoidable git porcelain differences in `specs/global/compatibility.md`.

## Open implementation questions

- Exact list of “vendor-like heavy dirs” must match this feature’s discovery rules (do not invent extras).
