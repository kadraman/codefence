# Implementation Plan: Deps Extractors

**Spec**: [spec.md](spec.md) | **Date**: 2026-09-20 | **Branch**: `feat/008-deps-extractors`

## Summary

Implement MVP manifest extractors (npm for JS/TS, Go, and Python / PyPI) in `internal/scan/deps/extract/` with lockfile preference, range skip, and a **10 MiB** lockfile read cap. Produce coordinates for OSV (query owned by feature `009`). Post-MVP ecosystems stay on the roadmap — do not implement them in this feature.

## Technical context

- **Packages / surfaces**: `internal/scan/deps/extract/...`; trigger/discovery may share `internal/scan/deps/`
- **Language**: Go
- **Testing**: table tests + golden JSON under `testdata/deps/` (npm + Go + Python)
- **NFR**: `MAX_LOCKFILE_BYTES = 10 MiB`; share YAML/TOML with config/secrets when possible (pnpm, Poetry, uv, Pipfile)
- **Performance / constraints**: pure Go parsers preferred; per-file extractors for reviewability

## Constitution Check

GATE: must pass before implementation. Re-check after design changes.

- [ ] No invented CLI/config/rule/finding/MCP behavior — ecosystems and precedence from the MVP matrix only
- [ ] Core contract impact identified — dependency extractor ecosystems (constitution § III); MVP scope is npm + Go + Python
- [ ] Required behavior preserved or deliberate difference documented in spec + compatibility.md
- [ ] NFR / dependency budget impact assessed — 10 MiB cap; shared YAML/TOML
- [ ] Security boundaries preserved — no network in extractors; OSV later sends coordinates only
- [ ] Tests planned for new behavior — per-ecosystem tables (MVP), precedence, size cap, goldens

**Exceptions** (fill only if a principle cannot be met):

| Principle | Why needed | Simpler alternative rejected because |
|-----------|------------|-------------------------------------|
| | | |

## Project structure

```text
internal/scan/deps/extract/     # node.go, golang.go, python.go, shared helpers
internal/scan/deps/dispatch.go  # basename / extension matchers (MVP only)
testdata/deps/                  # fixtures + golden coordinate JSON
```

## Implementation

### Library / package changes

1. Dispatch table for MVP basename/extension matchers.
2. Extractors for npm, Go, and Python with documented lock prefer / trigger-only rules.
3. Shared helpers: range skip, lock-on-disk warning, 10 MiB read cap + warning.
4. Prefer pure Go; share YAML/TOML for `pnpm-lock.yaml`, `poetry.lock`, `uv.lock`, `Pipfile` / `Pipfile.lock` with config/secrets when possible.

### CLI changes

None specific to extractors; deps aspect flags remain in feature `001` / orchestration `005`.

### MCP changes

None dedicated; coordinates flow into deps aspect used by MCP via `RunScan`.

### Config / env changes

None new for extractors in this feature.

### Documentation updates

Update `docs/dependency-support.md` for MVP vs roadmap.

## Testing strategy

### Unit tests

- Table tests for npm, Go, and Python: exact pins, ranges skipped, lock preference, size cap.

### Integration / fixture tests

- Use fixtures from `examples/deps/**` (npm / Go / Python).
- Golden coordinate lists as JSON under `testdata/deps/`.

### NFR / manual

- Confirm oversized lockfile warns and does not fully read beyond 10 MiB.

## Migration and compatibility

Follow the MVP ecosystem matrix. Roadmap ecosystems require a new feature slice before implementation.

## Open implementation questions

- Exact Yarn Berry warn/empty message text: follow this feature’s acceptance scenarios.
- Exact pin parsing for `requirements.txt` / PEP 621 `pyproject.toml` vs Poetry/uv lock contents: follow FR-003 (ranges need a lock in scope).
