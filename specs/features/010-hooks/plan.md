# Implementation Plan: Hooks and Background Scanning

**Spec**: [spec.md](spec.md) | **Date**: 2026-09-19 | **Branch**: `feat/010-hooks`

## Summary

Implement `pre-commit`, `background-scan`, `scan-worker`, and `install-hooks` so Git and IDE flows invoke the `codefence` binary on PATH, with 2s debounce and code-cache writes under `.codefence/`.

## Technical context

- **Packages / surfaces**: `internal/hooks`, `cmd/codefence`, `internal/cli`, scan via `internal/scan`
- **Language**: Go
- **Testing**: temp git repos, fake clock for debounce, dry-run install tests
- **NFR**: workers must not listen on a network port (constitution § VI)
- **Performance / constraints**: full staged scan always in v1; debounce default 2s

## Constitution Check

GATE: must pass before implementation. Re-check after design changes.

- [ ] No invented CLI/config/rule/finding/MCP behavior
- [ ] Core contract impact identified (aspects, Finding/NDJSON, config, rule IDs) or N/A — **CLI commands only; scan semantics unchanged**
- [ ] Required behavior preserved or deliberate difference documented in spec + compatibility.md — **hooks invoke the `codefence` binary (PATH) already listed in compatibility.md**
- [ ] NFR / dependency budget impact assessed
- [ ] Security boundaries preserved — **no background network listener**
- [ ] Tests planned for new behavior

**Exceptions** (fill only if a principle cannot be met):

| Principle | Why needed | Simpler alternative rejected because |
|-----------|------------|-------------------------------------|
| | | |

## Project structure

```text
internal/hooks/              # pre-commit, background-scan, scan-worker, debounce, install
internal/hooks/*_test.go
cmd/codefence/               # dispatch to hooks commands
docs/hooks.md                # PATH / absolute path requirements
```

## Implementation

### Library / package changes

1. `pre-commit`: invoke scan library as `scan --staged`; propagate non-zero exit on findings.
2. `background-scan`: accept `--file`, stdin JSON (`file_path`), or env; debounce (2s); spawn/detach `scan-worker`.
3. Debounce state in `.codefence/debounce.json` — first save immediate; resets within window; no immediate re-queue after just-completed scan.
4. `scan-worker`: run scan for target; write per-file findings to `.codefence/cache/code/`.
5. `install-hooks`: write `.git/hooks/pre-commit` script invoking `codefence pre-commit`; create `.cursor/hooks.json` / `.kiro/hooks.json` if missing (never overwrite); `--dry-run`.

### CLI changes

Register commands in `internal/cli` / `cmd/codefence` per feature `001` (no new invented command names).

### MCP changes

N/A (hooks are CLI/process).

### Config / env changes

Document PATH / absolute binary path for hooks; use existing local-state dirs from `002`.

### Documentation updates

Update `docs/hooks.md` with binary PATH / absolute path requirements.

## Testing strategy

### Unit tests

- Debounce with fake clock (immediate / window / no re-queue)
- hooks.json create-if-missing / never-overwrite
- dry-run no writes

### Integration / fixture tests

- Temp git repo: failing staged content → pre-commit non-zero
- Worker writes under `.codefence/cache/code/`

### NFR / manual

- Confirm worker does not open a listen socket

## Migration and compatibility

Hooks invoke the `codefence` binary on PATH (or absolute path). Already recorded in `specs/global/compatibility.md`. Document PATH requirements.

## Open implementation questions

1. Exact env var name(s) for background-scan file path — use the documented hook env without inventing new public names.
2. Windows vs POSIX pre-commit script packaging details (portable script invoking PATH binary).
