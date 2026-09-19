# Implementation Plan: Dependency Vulnerability Scanning (OSV)

**Spec**: [spec.md](spec.md) | **Date**: 2026-09-19 | **Branch**: `feat/009-deps-scanning`

## Summary

Implement the deps aspect OSV client: `querybatch` (batch 100), concurrency 8, disk cache with TTL, HTTP/2 modes, fail-closed on vulns and provider errors, and a clear custom-provider stub. Reuse extractors from `008` and Finding fields from `003`.

## Technical context

- **Packages / surfaces**: `internal/scan/deps`, `internal/cache`, `internal/findings`, wiring from `internal/scan`, CLI flags via `internal/cli` / `internal/config`
- **Language**: Go (module in repo root)
- **Testing**: `go test ./...`, mock HTTP OSV server, fixtures under `testdata/`
- **NFR**: reuse one HTTP client per process (esp. MCP); no new heavy deps; budgets in `specs/global/nfr.md`
- **Performance / constraints**: batch 100; concurrency 8; lockfile caps owned by extractors (10 MiB)

## Constitution Check

GATE: must pass before implementation. Re-check after design changes.

- [ ] No invented CLI/config/rule/finding/MCP behavior
- [ ] Core contract impact identified (aspects, Finding/NDJSON, config, rule IDs) or N/A — **deps aspect + `vulnerable-dependency` + deps config keys**
- [ ] Required behavior preserved or deliberate difference documented in spec + compatibility.md
- [ ] NFR / dependency budget impact assessed — prefer stdlib `net/http` + HTTP/2; no large SDK
- [ ] Security boundaries preserved (path confinement, evidence, remote integrity) — **OSV receives coordinates only**
- [ ] Tests planned for new behavior

**Exceptions** (fill only if a principle cannot be met):

| Principle | Why needed | Simpler alternative rejected because |
|-----------|------------|-------------------------------------|
| | | |

## Project structure

```text
internal/scan/deps/          # OSV client, cache keying, advisory→Finding map, HTTP/2 dial
internal/scan/deps/*_test.go
internal/cache/              # shared helpers if needed for .codefence/cache/deps/
testdata/deps/osv/           # mock responses / fixtures
docs/                        # HTTP/2 mapping notes if user-facing
```

## Implementation

### Library / package changes

1. OSV `querybatch` client: batch size 100, enrichment concurrency 8, retries with `[0, 300]ms` backoff, timeout from config/flags (default 15s).
2. Disk cache under `.codefence/cache/deps/` keyed by provider + coordinate set; TTL default 24h; honor `--deps-refresh`.
3. Map advisories → `findings.Finding` with `ruleId: vulnerable-dependency`, severity, advisory/CVE, fixed version, remediation, `kind: dependency`.
4. Fail deps aspect when any vuln finding exists; fail with actionable error on provider failure; no query when zero coordinates (warn if manifests unpinned).
5. HTTP/2: `auto|on|off` via HTTP transport; document the mapping.
6. Provider model: `osv` default/required; `custom` config surface + clear not-supported unless OSV-compatible URL with `osv` + `--deps-provider-url`.

### CLI changes

Wire existing deps flags from `001` / `002` (no new invented flags): `--deps-provider`, `--deps-provider-url`, `--deps-refresh`, `--deps-cache-ttl`, `--deps-timeout`, `--deps-http2`, `--deps-scope`.

### MCP changes

Expose the same client/cache to `deps_lookup` in feature `012` (this plan delivers the library; MCP wires it).

### Config / env changes

Consume `deps.*` schema and `CODEFENCE_DEPS_*` from feature `002` — do not invent keys.

### Documentation updates

Document HTTP/2 mapping and custom URL policy; keep notes in `specs/global/compatibility.md` if needed (no deliberate CLI exit change here).

## Testing strategy

### Unit tests

- Severity/advisory mapping
- Cache key + TTL hit/miss
- HTTP/2 mode selection
- Custom provider error path
- Zero-coordinate no-network

### Integration / fixture tests

- Mock OSV HTTP server for batch/query
- Timeout and retry
- Aspect failure when vulns present
- Tree vs changed scope wiring with orchestrator fixtures

### NFR / manual

- Confirm no unexpected direct module deps; MCP process reuses client when `012` lands

## Migration and compatibility

Required OSV behavior. Deliberate stubs: BOM resolution deferred; `go.sum` trigger-only. Custom provider is stub/error unless OSV-compatible URL policy.

## Open implementation questions

1. Exact on-disk cache filename/hash format — choose a stable scheme without inventing user-visible CLI behavior (internal only).
2. Precise `auto|on|off` → HTTP/2 transport mapping table for docs.
