---
title: "Dependency Vulnerability Scanning (OSV)"
id: 9
slug: "deps-scanning"
status: specified
authors: ["@kadraman"]
created: 2026-09-19
updated: 2026-09-19
issue: "https://github.com/kadraman/codefence/issues/9"
area: deps
---

# Feature Specification: Dependency Vulnerability Scanning (OSV)

## Summary

Implement the `deps` aspect: when manifests are in scope, extract package coordinates, query OSV (default), cache results under `.codefence/cache/deps/`, and emit `vulnerable-dependency` findings.

## Problem

Vulnerable or hallucinated packages can enter projects via AI suggestions. Shipping a local full vulnerability database is impractical; OSV batch query is the default intelligence source. Without a shared client, cache, and fail-closed policy, agents and CI would silently miss known vulns or pass on provider errors.

## User scenarios

### User Story 1 — OSV batch query and findings (Priority: P1)

**Why this priority**: Core of the deps aspect — without querying and mapping advisories, dependency scanning has no product value.

**Independent test**: Fixture manifests with known vulnerable pins against a mock OSV HTTP server produce Finding-shaped `vulnerable-dependency` results with severity, advisory/CVE IDs, fixed version, and remediation.

**Acceptance scenarios**:

1. **Given** manifests in scan scope (or `--deps-scope tree` discovery) yield one or more `(ecosystem, name, version)` coordinates, **When** the deps aspect runs with provider `osv`, **Then** the client calls OSV `querybatch` with batch size **100** and enrichment concurrency **8**.
2. **Given** OSV returns advisories for a coordinate, **When** findings are emitted, **Then** each uses rule ID `vulnerable-dependency` and includes severity, advisory/CVE IDs, fixed version, and remediation fields per the finding model.
3. **Given** at least one vulnerable-dependency finding exists for the run, **When** the deps aspect finishes, **Then** the aspect fails (non-zero / failed status) — do not silently pass.
4. **Given** retries are needed, **When** transient failures occur, **Then** the client retries with short backoff `[0, 300]ms`.
5. **Given** `--deps-timeout` is unset, **When** queries run, **Then** the default timeout is `15s`.

### User Story 2 — Disk cache and refresh (Priority: P1)

**Why this priority**: Cache hits avoid network in hooks/CI and are required for MCP `deps_lookup` reuse.

**Independent test**: Second scan with identical provider + coordinate set does not hit the network when TTL is valid and `--deps-refresh` is false.

**Acceptance scenarios**:

1. **Given** a successful provider response, **When** results are stored, **Then** they are cached under `.codefence/cache/deps/` keyed by provider + coordinate set.
2. **Given** a valid cache entry within TTL (default `24h` / `--deps-cache-ttl`), **When** the same coordinates are queried without `--deps-refresh`, **Then** the network is not used.
3. **Given** `--deps-refresh` is set (or TTL expired), **When** coordinates are queried, **Then** the provider is contacted and the cache is updated.

### User Story 3 — HTTP/2 and provider surface (Priority: P2)

**Why this priority**: Flag/config surface and a clear custom-provider stub prevent silent misconfiguration.

**Independent test**: `--deps-http2 auto|on|off` selects `http.Client` / HTTP2 transport behavior; `custom` without a supported endpoint fails with an actionable error.

**Acceptance scenarios**:

1. **Given** `--deps-http2` is `auto`, `on`, or `off`, **When** the OSV HTTP client is built, **Then** HTTP/2 behavior follows that mode (document the transport mapping).
2. **Given** `--deps-provider osv` (default), **When** deps runs, **Then** the OSV API is used.
3. **Given** `--deps-provider custom`, **When** deps runs without an OSV-compatible custom endpoint policy, **Then** the aspect fails with a clear “not supported” (or equivalent actionable) error.
4. **Given** an OSV-compatible custom URL via `--deps-provider-url` with provider `osv`, **When** deps runs, **Then** queries target that URL (custom URL allowed with `osv`).

### User Story 4 — Network policy and empty coordinates (Priority: P1)

**Why this priority**: Fail-closed provider errors and no spurious network calls are security and CI correctness requirements.

**Independent test**: Zero coordinates → no HTTP; mock provider 5xx → deps aspect fails with actionable error.

**Acceptance scenarios**:

1. **Given** zero coordinates extracted, **When** the deps aspect runs, **Then** no provider query is made; if manifests were present but unpinned, emit a warning.
2. **Given** the provider fails (timeout, HTTP error, malformed body), **When** the deps aspect handles the error, **Then** it fails with an actionable error — do not silently pass.
3. **Given** MCP `deps_lookup` is invoked for a single coordinate set, **When** the lookup runs, **Then** it uses the same OSV client and cache as scan (see feature `012-mcp-server`).

### Edge cases

- Manifests in scope but only version ranges / no lock pins → warn; no query when zero coordinates.
- Tree vs changed scope: discovery and coordinate set follow orchestrator/`--deps-scope` (wired with features `005` / `008`).
- Gradle/Maven BOM resolution — post-MVP (JVM roadmap).
- `go.sum` extraction — trigger-only until specified elsewhere; do not invent extraction here.

## Requirements

### Functional requirements

- **FR-001**: System MUST run the deps aspect when dependency manifests are in scan scope or when `--deps-scope tree` discovery applies (orchestration owned by feature `005`; this feature owns query/cache/findings).
- **FR-002**: System MUST obtain `(ecosystem, name, version)` coordinates via extractors (feature `008`) before querying.
- **FR-003**: Default provider MUST be OSV using the `querybatch` API with batch size **100** and enrichment concurrency **8**.
- **FR-004**: System MUST retry transient failures with short backoff `[0, 300]ms`.
- **FR-005**: System MUST honor `--deps-timeout` (default `15s`) and `--deps-cache-ttl` (default `24h`).
- **FR-006**: System MUST cache results under `.codefence/cache/deps/` by provider + coordinate set and honor `--deps-refresh`.
- **FR-007**: System MUST map advisories to unified findings with rule ID `vulnerable-dependency`, severity, advisory/CVE IDs, fixed version, and remediation.
- **FR-008**: System MUST fail the deps aspect when any vuln finding exists for the run.
- **FR-009**: System MUST support `--deps-http2` values `auto|on|off` via `http.Client` / HTTP2 transport configuration.
- **FR-010**: Provider `osv` MUST be required and default; provider `custom` MUST expose config surface and fail clearly unless an OSV-compatible URL policy is used (`--deps-provider-url` with `osv` as documented).
- **FR-011**: System MUST NOT query the provider when zero coordinates are extracted; MUST warn when manifests are present but unpinned.
- **FR-012**: On provider failure, system MUST fail the deps aspect with an actionable error (not silent pass).
- **FR-013**: MCP `deps_lookup` MUST reuse the same client and cache (implementation in `012`; contract here).
- **FR-014**: CLI/env flags for deps MUST align with features `001-cli-and-commands` and `002-config-and-env` (`--deps-provider`, `--deps-provider-url`, `--deps-refresh`, `--deps-cache-ttl`, `--deps-timeout`, `--deps-http2`, `--deps-scope`).

### Non-goals

- Implementing ecosystem extractors (feature `008`; MVP = npm + Go).
- Local offline vulnerability database.
- Post-MVP ecosystems and Gradle/Maven BOM resolution (see `008` roadmap).
- Inventing `go.sum` version extraction beyond trigger-only until separately specified.
- Changing Finding schema field names (feature `003`) or CLI NDJSON wire keys (feature `004`).

## Success criteria

- **SC-001**: Mock OSV server tests cover batch/query, cache hit (no network), timeout, and retry paths.
- **SC-002**: Severity/advisory mapping unit tests pass for representative advisories.
- **SC-003**: HTTP/2 option behavior is documented and covered by tests.
- **SC-004**: Findings use stable rule ID `vulnerable-dependency` and required deps fields.
- **SC-005**: Tree vs changed scope is wired so deps only queries coordinates from the orchestrator’s scope decision.

## Assumptions

- Feature `008-deps-extractors` supplies coordinates; this feature consumes them.
- Feature `003-finding-model` defines Finding fields; `005-scan-orchestrator` decides when deps runs.
- Config/env defaults (`provider: osv`, `cache_ttl: 24h`, `timeout: 15s`, `http2: auto`, `scope: changed`) match `002-config-and-env`.

## Open questions

1. Post-MVP ecosystems / Gradle-Maven BOM — see `008` roadmap.
2. `go.sum` extraction — trigger-only until specified.

## References

- Related: `008-deps-extractors`, `005-scan-orchestrator`, `003-finding-model`, `012-mcp-server`
- Docs: `docs/dependency-support.md`
