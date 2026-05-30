---
title: "Vulnerable Dependency Scanning With OSV Default"
status: partial
owners: ["@kadraman"]
created: 2026-05-25
updated: 2026-05-30
issue: "TBD"
scope: "scan|cli|hooks|docs"
---

## Summary

This feature adds dependency vulnerability scanning to Codefence using an external vulnerability source, with OSV as the default provider. The scanner should detect when dependency manifests change, resolve affected packages, and query the provider API for known vulnerabilities. The provider integration must be configurable, but work out of the box against OSV.

**Implementation status (2026-05-27):** OSV scanning, CLI, cache, HTTP/2, severity mapping, tree-scope manifest discovery, npm `package.json` extraction (exact versions), and npm lockfile-aware resolution are **shipped**. Non-npm ecosystems and custom providers remain **open** (see checklist below). Ecosystem support matrix: [dependency-support.md](../dependency-support.md).

## Problem Statement

Codefence currently focuses on local secure-coding checks and secret detection, but does not provide first-class dependency vulnerability detection. A fully local vulnerability database is not practical for this project, so vulnerability intelligence must come from an external source. Without this feature, known vulnerable dependencies can be introduced without immediate feedback in local workflows and CI.

## Proposed Solution

### Behavior

The dependency scanner should:

1. Detect manifest changes in scan scope and trigger dependency vulnerability analysis.
2. Support a configurable external vulnerability provider.
3. Use OSV as the default provider when no custom provider is configured.
4. Query provider APIs for dependency/version pairs derived from manifest inputs.
5. Return normalized findings with package, version, advisory IDs, severity (`critical` \| `high` \| `medium` \| `low`), and remediation guidance.
6. Integrate with existing scan entry points (`scan`, `pre-commit`, `background-scan`) and existing scope controls (`--staged`, `--paths`, `--only`, `--skip`).
7. Cache query results for performance while allowing refresh when manifests or lockfiles change.

### Manifest Triggers

A vulnerability query should run when a changed file is recognized as a dependency manifest. Initial set:

1. `package.json`
2. `package-lock.json`
3. `yarn.lock`
4. `pnpm-lock.yaml`
5. `requirements.txt`
6. `Pipfile`
7. `pyproject.toml`
8. `pom.xml`
9. `build.gradle`
10. `Gemfile`
11. `composer.json`
12. `.sln`
13. `.csproj`

Additional manifests can be added over time (for example lockfiles and language-specific dependency files).

### Provider Model

Provider behavior should be:

1. Default provider: OSV
2. Configurable provider endpoint and auth settings
3. Provider abstraction so OSV and future sources share a common finding model
4. Stable fallback behavior when provider is unavailable (clear warning/error policy)

### OSV Integration Requirements

1. Default dataset/source should be OSV (https://osv.dev/list).
2. Query API should use OSV API semantics (https://google.github.io/osv.dev/api/).
3. Respect response-size behavior:
   - HTTP/1.1: 32 MiB response limit
   - HTTP/2: no response size limit
4. Prefer HTTP/2 for potentially large responses (for example large ecosystem queries).
5. Add safeguards for oversized or long-running requests (timeouts, retries, bounded concurrency).

### CLI Surface

Proposed updates to `codefence scan`:

1. Enable dependency vulnerability scanning aspect:
   - `--only deps`
   - `--skip deps`
2. Provider controls:
   - `--deps-provider <osv|custom>` (default: `osv`)
   - `--deps-provider-url <url>` (optional override)
3. Query behavior controls:
   - `--deps-refresh` (ignore cache and re-query)
   - `--deps-cache-ttl <duration>`
   - `--deps-timeout <duration>`
4. Transport preferences:
   - `--deps-http2 <auto|on|off>` (default: `auto` uses Node fetch; `on`/`off` use undici `Agent.allowH2`)
5. Manifest scope:
   - `--deps-scope <changed|tree>` (default: `changed` = git/`--paths` manifests only; `tree` = discover all manifests under repo or `--paths` roots)

No direct behavior change expected for:

- `codefence install`
- `codefence install-hooks`

These commands should continue to work; hook-driven scan flows should include dependency checks when manifests are in scope.

### Config And Environment

Proposed environment variables:

1. `CODEFENCE_DEPS_PROVIDER`
2. `CODEFENCE_DEPS_PROVIDER_URL`
3. `CODEFENCE_DEPS_CACHE_TTL`
4. `CODEFENCE_DEPS_TIMEOUT`
5. `CODEFENCE_DEPS_HTTP2`
6. `CODEFENCE_DEPS_SCOPE` (same as `--deps-scope`)

Cache should live under `.codefence/` with metadata (provider, request key, timestamp, TTL, checksum/version where applicable). **Implemented** under `.codefence/cache/deps/`.

### Examples

Default OSV scanning for staged manifest changes:

```bash
codefence scan --staged --only deps
```

Force refresh and prefer HTTP/2 explicitly:

```bash
codefence scan --staged --only deps --deps-refresh --deps-http2 on
```

Use custom provider endpoint:

```bash
codefence scan --staged --only deps --deps-provider custom --deps-provider-url https://vuln.example.com/api
```

Example finding (normalized):

```text
[high] vulnerable-dependency
file: package.json
package: lodash
version: 4.17.20
advisory: GHSA-xxxx-xxxx-xxxx
message: Known vulnerability detected in dependency version
remediation: Upgrade to >= 4.17.21
```

## Implementation Plan

### Areas Touched

Expected implementation areas:

1. `src/scan/*` for orchestration, aspect wiring, and option parsing
2. `src/scan/aspects/*` for dependency vulnerability scanning aspect
3. New provider modules under `src/scan/deps/` (provider interface, OSV adapter, transport, caching)
4. `src/cli.ts` and `src/scan/parseOptions.ts` for CLI flags and help text
5. `src/hooks/*` for hook path consistency with new aspect behavior
6. `tests/*` for parser, provider, cache, and integration coverage
7. `README.md` and `docs/*` for user-facing behavior

### Step-by-Step Plan

1. [x] Add dependency scanning aspect identifier and registry wiring.
2. [x] Implement manifest detection and changed-file trigger logic.
3. [x] Implement dependency extraction per manifest type — npm `package.json` exact pins plus `package-lock.json`, `yarn.lock` (Classic), and `pnpm-lock.yaml`; see [lockfile-aware-dependency-extraction.md](./implemented/lockfile-aware-dependency-extraction.md).
4. [x] Define provider abstraction and normalized finding schema.
5. [x] Implement OSV provider client with HTTP/2 preference and HTTP/1.1 size-limit-safe behavior.
6. [x] Implement caching with TTL and refresh controls.
7. [x] Add retries/timeouts/error handling policy — timeouts + limited GET retry (`RETRY_DELAYS_MS`); batch POST has no retry loop.
8. [x] Wire new CLI flags and environment variable support (including `--deps-scope tree`).
9. [x] Add documentation and usage examples.
10. [x] Add end-to-end tests for manifest change scenarios — npm fixtures + stubbed/live OSV tests; not every manifest type.

### Backward Compatibility

Backward compatible by default:

1. Existing code scanning behavior remains available.
2. Dependency scanning is additive via aspect controls.
3. Existing commands/hooks keep working with expanded scan capability.

### Security Considerations

Benefits:

1. Earlier detection of known vulnerable dependencies.
2. Better local and CI feedback loops for dependency risk.

Risks:

1. Provider outage or rate limiting impacts scan completeness.
2. False negatives when manifest parsing is incomplete.
3. Data-volume and timeout issues on large queries.

Mitigations:

1. Provider retry/backoff strategy and clear degraded-mode messaging.
2. HTTP/2 preference for large responses.
3. Cache with bounded TTL and explicit refresh path.
4. Incremental manifest parser coverage with test fixtures.

## Testing Strategy

### Unit Tests

Add or update tests for:

1. Manifest detection (`package.json`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `requirements.txt`, `Pipfile`, `pyproject.toml`, `pom.xml`, `build.gradle`, `Gemfile`, `composer.json`, `.sln`, `.csproj`)
2. Dependency extraction per ecosystem
3. Provider request building and response normalization
4. Cache TTL/refresh behavior
5. CLI argument parsing for new flags
6. HTTP/2 preference and fallback behavior

Suggested files (actual):

| File | Status |
| ---- | ------ |
| `tests/manifests.test.ts` | [x] Manifest name detection |
| `tests/depsExtraction.test.ts` | [x] npm `package.json`, lockfiles, merge precedence |
| `tests/depsProviderOsv.test.ts` | [x] OSV batch/normalization/enrichment |
| `tests/depsHttpClient.test.ts` | [x] HTTP/2 transport |
| `tests/depsQuery.test.ts` | [x] Provider dispatch; custom rejected |
| `tests/depsExamples.test.ts` | [x] Fixture integration (stubbed fetch) |
| `tests/depsDiscoverManifests.test.ts` | [x] `--deps-scope tree` discovery |
| `tests/scanOptions.test.ts` | [x] CLI flags including deps |
| `tests/depsCache.test.ts` | [ ] Not added (cache covered indirectly via aspect runs) |

### CLI/Integration Tests

1. [x] Staged / explicit `package.json` paths trigger OSV query flow (`examples/deps`, `runScan` json test).
2. [x] Staged npm lockfiles and `package.json` trigger extraction + OSV query flow; other manifest names in `src/manifests.ts` trigger the aspect but have no extraction yet.
3. [x] `--deps-refresh` bypasses cache (wired in `deps` aspect).
4. [x] `--deps-http2 on` uses HTTP/2 transport path (`tests/depsHttpClient.test.ts`).
5. [x] Provider errors produce deterministic, actionable output (failed aspect + message).
6. [x] `--deps-scope tree` discovers manifests without git changes (`tests/depsDiscoverManifests.test.ts`).

### Required Validation Commands

```bash
npm test
npm run codefence
```

Feature is not complete until both commands pass.

## Migration Path

1. Introduce dependency scanning as a documented scan aspect.
2. Default provider to OSV with no additional setup required.
3. Add migration notes for teams that want custom providers.
4. Tune defaults (TTL, timeout, concurrency) based on pilot feedback.

## Implementation Checklist

### Done

- [x] Behavior is documented and unambiguous (`README.md`, `codefence scan --help`, this doc)
- [x] Manifest trigger detection implemented (`src/manifests.ts`, auto-add `deps` when manifests in scope or `--deps-scope tree`)
- [x] OSV provider integration implemented (`src/scan/deps/provider.ts`, `querybatch` + conditional per-advisory GET)
- [x] HTTP/2 preference and transport controls implemented (`--deps-http2`, `src/scan/deps/httpClient.ts`)
- [x] Cache and refresh behavior implemented (`src/scan/deps/cache.ts`, `--deps-refresh`, `--deps-cache-ttl`)
- [x] Timeouts and limited retry on provider GETs (`--deps-timeout`, `RETRY_DELAYS_MS` in provider)
- [x] Bounded concurrency for per-advisory enrichment (`VULN_DETAIL_CONCURRENCY`)
- [x] Findings normalized with remediation guidance (`DepsFinding`, table/json output, four severity levels)
- [x] CLI and environment variables (`--only`/`--skip deps`, provider URL, cache, HTTP/2, `--deps-scope`)
- [x] Full-repo manifest discovery (`--deps-scope tree`, `src/scan/deps/discoverManifests.ts`)
- [x] Hook integration (`pre-commit` / `runScan` with default deps options)
- [x] Tests added/updated (see [Testing Strategy](#testing-strategy))
- [x] `npm test` passes
- [x] `npm run codefence` passes
- [x] User-facing docs updated

### Open / partial

- [x] **npm lockfile extraction** — `package-lock.json` (v2/v3), `yarn.lock` (Classic), `pnpm-lock.yaml`; see [lockfile-aware-dependency-extraction.md](./implemented/lockfile-aware-dependency-extraction.md)
- [ ] **Dependency extraction** for non-npm manifests — [multi-ecosystem-manifest-extraction.md](./multi-ecosystem-manifest-extraction.md) (Python `requirements.txt`, `Pipfile`, and `pyproject.toml` shipped; other ecosystems remain open)
- [ ] **Custom provider** (`--deps-provider custom`) — CLI flag exists; `queryDependencies` throws until a provider API ships
- [ ] **Provider authentication** for custom/private endpoints
- [ ] **Dedicated deps cache unit tests** (`tests/depsCache.test.ts`)
- [ ] **Integration tests** per manifest type (extraction + OSV) for non–`package.json` ecosystems
- [ ] **Retry/backoff on batch POST** (GET enrichment retries once after 300ms today)
- [ ] **Raw provider response artifacts** in cache for debugging (optional; see open questions)

## Future Enhancements

1. Additional npm lockfile coverage (Yarn Berry, `package-lock.json` v1, shrinkwrap) — see [lockfile-aware-dependency-extraction.md](./implemented/lockfile-aware-dependency-extraction.md)
2. Additional ecosystems (Python, Go, JVM, .NET, …) — see [multi-ecosystem-manifest-extraction.md](./multi-ecosystem-manifest-extraction.md)
3. Multi-provider aggregation with deduplication
4. Authenticated provider support with secret-safe credential handling
5. Baseline/suppressions for accepted dependency risk

## Open Questions

1. ~~Should dependency scanning be included in default scan aspects or opt-in initially?~~ **Resolved:** Default aspect is `code` only; `deps` auto-runs when dependency manifests are in the git/`--paths` scope, or when `--deps-scope tree` is set (unless `--only` / `--skip deps`).
2. ~~Which lockfiles are in scope for initial implementation?~~ **Resolved:** All names in [Manifest Triggers](#manifest-triggers) trigger scans and tree discovery; npm version resolution from `package-lock.json`, `yarn.lock` (Classic), and `pnpm-lock.yaml` is shipped — see [lockfile-aware-dependency-extraction.md](./implemented/lockfile-aware-dependency-extraction.md).
3. ~~What is the exact timeout/retry policy for provider calls?~~ **Resolved (v1):** Configurable timeout via `--deps-timeout` (default 15s); GET retries once after 300ms; batch query uses single attempt with abort timeout; enrichment concurrency capped at 8.
4. Should provider responses be persisted as raw cache artifacts for debugging? **Open.**
5. ~~How should severity be mapped when provider metadata is incomplete?~~ **Resolved:** OSV text labels map directly; numeric CVSS uses ≥9 critical, ≥7 high, ≥4 medium, &lt;4 low; unknown metadata defaults to `medium`.

### Severity mapping (implemented)

| Input | Unified severity |
| ----- | ---------------- |
| Label contains `critical` | `critical` |
| Label contains `high` | `high` |
| Label contains `medium` | `medium` |
| Label contains `low` | `low` |
| CVSS base score ≥ 9.0 | `critical` |
| CVSS base score 7.0–8.9 | `high` |
| CVSS base score 4.0–6.9 | `medium` |
| CVSS base score &lt; 4.0 | `low` |
| No usable metadata | `medium` (default) |

## References

1. OSV database listing: https://osv.dev/list
2. OSV API docs: https://google.github.io/osv.dev/api/
3. Codefence README and scan command behavior
4. Codefence CONTRIBUTING guidelines

## Additional Notes

A local vulnerability database is out of scope for this feature. The implementation should stay lightweight and embeddable, with predictable performance for local development and CI use. Transport and caching defaults should prioritize reliability while keeping scans fast and deterministic.
