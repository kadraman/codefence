---
title: "Vulnerable Dependency Scanning With OSV Default"
status: proposed
owners: ["@kadraman"]
created: 2026-05-25
updated: 2026-05-25
issue: "TBD"
scope: "scan|cli|hooks|docs"
---

## Summary

This feature adds dependency vulnerability scanning to Codefence using an external vulnerability source, with OSV as the default provider. The scanner should detect when dependency manifests change, resolve affected packages, and query the provider API for known vulnerabilities. The provider integration must be configurable, but work out of the box against OSV.

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

Cache should live under `.codefence/` with metadata (provider, request key, timestamp, TTL, checksum/version where applicable).

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

1. Add dependency scanning aspect identifier and registry wiring.
2. Implement manifest detection and changed-file trigger logic.
3. Implement dependency extraction per manifest type (initial set: npm, Gradle, .NET project/solution).
4. Define provider abstraction and normalized finding schema.
5. Implement OSV provider client with HTTP/2 preference and HTTP/1.1 size-limit-safe behavior.
6. Implement caching with TTL and refresh controls.
7. Add retries/timeouts/error handling policy.
8. Wire new CLI flags and environment variable support.
9. Add documentation and usage examples.
10. Add end-to-end tests for manifest change scenarios.

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

Suggested files:

1. `tests/depsManifestDetection.test.ts`
2. `tests/depsExtraction.test.ts`
3. `tests/depsProviderOsv.test.ts`
4. `tests/depsCache.test.ts`
5. `tests/scanOptions.test.ts` (extend)

### CLI/Integration Tests

1. Staged `package.json` change triggers OSV query flow.
2. Staged changes in each initial manifest type trigger OSV query flow (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `requirements.txt`, `Pipfile`, `pyproject.toml`, `pom.xml`, `build.gradle`, `Gemfile`, `composer.json`, `.sln`, `.csproj`).
3. `--deps-refresh` bypasses cache.
4. `--deps-http2 on` uses HTTP/2 transport path.
5. Provider errors produce deterministic, actionable output.

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

- [ ] Behavior is documented and unambiguous
- [ ] Manifest trigger detection implemented
- [ ] Dependency extraction implemented for initial manifest set (`package.json`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `requirements.txt`, `Pipfile`, `pyproject.toml`, `pom.xml`, `build.gradle`, `Gemfile`, `composer.json`, `.sln`, `.csproj`)
- [ ] OSV provider integration implemented
- [ ] HTTP/2 preference and transport controls implemented
- [ ] Cache and refresh behavior implemented
- [ ] Findings normalized with remediation guidance
- [ ] Tests added/updated
- [ ] `npm test` passes
- [ ] `npm run codefence` passes
- [ ] User-facing docs updated

## Future Enhancements

1. Lockfile-aware resolution for higher precision
2. Additional ecosystems (for example Python, Ruby, Go)
3. Multi-provider aggregation with deduplication
4. Authenticated provider support with secret-safe credential handling
5. Baseline/suppressions for accepted dependency risk

## Open Questions

1. Should dependency scanning be included in default scan aspects or opt-in initially?
2. Which lockfiles are in scope for initial implementation?
3. What is the exact timeout/retry policy for provider calls?
4. Should provider responses be persisted as raw cache artifacts for debugging?
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
