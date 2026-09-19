# Implementation Plan: Secret Engine

**Spec**: [spec.md](spec.md) | **Date**: 2026-09-19 | **Branch**: `feat/007-secret-engine`

## Summary

Implement Semgrep-subset YAML secret matching + entropy under `internal/scan/secret`, embed `rules/secret/builtin.yml`, and cache remote packs under `.codefence/cache/secret-rules/` with integrity checks. Wire into the `code` aspect with lazy CLI load and MCP in-memory reuse.

## Technical context

- **Packages / surfaces**: `internal/scan/secret`, `internal/cache`, `rules/secret/builtin.yml` (`go:embed`); wired from `internal/scan/code`
- **Language**: Go
- **Testing**: `go test ./...`; fixtures under `testdata/secrets/`
- **NFR**: lazy secret load; compile regex once; B7 YAML dependency allowlisted; do not embed example fixtures in release binary
- **Performance / constraints**: parse remote YAML once per scan; MCP retains compiled rules across tool calls

## Constitution Check

GATE: must pass before implementation. Re-check after design changes.

- [ ] No invented CLI/config/rule/finding/MCP behavior — Semgrep subset and flags from existing specs only
- [ ] Core contract impact identified — secret rule IDs + Semgrep-subset YAML surface (constitution § III)
- [ ] Required behavior preserved or deliberate difference documented in spec + compatibility.md
- [ ] NFR / dependency budget impact assessed — shared small YAML dep; lazy init
- [ ] Security boundaries preserved — remote integrity before activation; evidence truncation
- [ ] Tests planned for new behavior — fixtures, entropy skip, merge, cache TTL/refresh, YAML errors

**Exceptions** (fill only if a principle cannot be met):

| Principle | Why needed | Simpler alternative rejected because |
|-----------|------------|-------------------------------------|
| | | |

## Project structure

```text
rules/secret/builtin.yml          # embed source
internal/scan/secret/             # parser, matcher, entropy, merge, remote cache
internal/cache/                   # .codefence/cache helpers if shared
testdata/secrets/                 # builtin + entropy + merge fixtures
```

## Implementation

### Library / package changes

1. YAML subset parser with documented supported fields (`pattern-regex`, `pattern`, `patterns`, `pattern-either`).
2. Builtin embed + pack version metadata.
3. Entropy + merge/dedup + lockfile mitigations.
4. Remote fetch: checksum, TTL cache, refresh flag.
5. Wire flags/env/config from `001`/`002`.

### CLI changes

Consume secret flags already specified in feature `001`; no new flag names.

### MCP changes

Keep compiled rules in memory across tool calls (process lifetime).

### Config / env changes

Consume secret-related config/env keys from feature `002`; do not invent keys.

### Documentation updates

Document supported YAML subset in this feature’s notes or `docs/` if user-facing packs are described.

## Testing strategy

### Unit tests

- Parser subset + error cases.
- Entropy threshold/min length/confidence.
- Merge/dedup and lockfile skip.

### Integration / fixture tests

- Use fixtures from `examples/secrets` / `testdata/secrets`.
- Cache TTL / refresh behavior.

### NFR / manual

- Confirm `version` / `--help` / MCP `tools/list` do not load secret rules.
- Binary does not embed fixture trees.

## Migration and compatibility

Preserve builtin rule IDs. Any pack format difference must be documented in `compatibility.md`.

## Open implementation questions

- Exact checksum metadata format: match the remote pack contract (do not invent a new integrity scheme).
