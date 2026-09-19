---
title: "Secret Engine"
id: 7
slug: "secret-engine"
status: specified
authors: ["@kadraman"]
created: 2026-09-19
updated: 2026-09-19
issue: "https://github.com/kadraman/codefence/issues/7"
area: secrets
---

# Feature Specification: Secret Engine

## Summary

Implement the Semgrep-compatible secret engine: builtin YAML rules (`go:embed`), optional local/remote YAML packs, Shannon entropy heuristics, finding merge/dedup, confidence filtering, and TTL disk cache under `.codefence/cache/secret-rules/`. Detection quality MUST meet the acceptance criteria while improving throughput and startup (lazy rule load).

## Problem

Secrets leak via AI context and commits. Portable YAML rules + entropy must meet detection quality while satisfying NFR lazy-init and MCP in-memory rule reuse.

## User scenarios

### User Story 1 — Load and match Semgrep-subset YAML (Priority: P1)

**Why this priority**: Builtin + pack loading is the primary detection path.

**Independent test**: Fixture tests under `testdata/secrets/`; YAML parse error messages actionable.

**Acceptance scenarios**:

1. **Given** default settings, **When** the `code` aspect runs secrets, **Then** builtin rules are loaded (default on) from embedded content equivalent to `rules/secret/builtin.yml`.
2. **Given** `--secret-rules` paths and/or an optional remote bundle, **When** rules load, **Then** those packs are included with the supported Semgrep-subset fields: `pattern-regex`, `pattern`, `patterns`, `pattern-either`.
3. **Given** unsupported Semgrep fields beyond that subset, **When** parsing, **Then** they are not invented as extra Semgrep features (supported subset only).
4. **Given** invalid YAML, **When** parsing fails, **Then** errors are actionable.

### User Story 2 — Entropy, merge, and filters (Priority: P1)

**Why this priority**: Entropy + merge define false-positive control.

**Acceptance scenarios**:

1. **Given** assignment-like candidates, **When** entropy analysis runs, **Then** defaults apply unless overridden: entropy threshold `4.2`, min length `12`, min confidence `low`.
2. **Given** correlated rule and entropy hits, **When** merge/dedup runs, **Then** findings merge as `rule+entropy` when correlated.
3. **Given** lockfile-noise keys and path-only registry URLs, **When** entropy runs, **Then** those cases are skipped.
4. **Given** confidence filtering, **When** findings are emitted, **Then** results below the configured min confidence are filtered.

### User Story 3 — Remote cache and performance (Priority: P2)

**Why this priority**: Remote packs and lazy load are required for NFR and ops.

**Acceptance scenarios**:

1. **Given** a remote secret-rules URL, **When** rules are fetched, **Then** checksum metadata is verified before activation, with TTL disk cache under `.codefence/cache/secret-rules/` (default TTL `24h`) and `--secret-rules-refresh` forcing refresh.
2. **Given** CLI mode, **When** `code` aspect has not started, **Then** secret rules are not loaded (lazy).
3. **Given** MCP mode, **When** multiple tool calls run, **Then** the compiled rule set stays in memory across calls; all active regexes compile once per process.
4. **Given** a scan, **When** remote YAML is used, **Then** it is parsed once per scan (not per file).

### Edge cases

- What happens when default builtin rules are turned off via `--secret-default-rules off`?
- What happens when evidence would contain a full secret (truncate; do not write full secrets to logs)?

## Requirements

### Functional requirements

- **FR-001**: System MUST load rules: builtin (default on) + `--secret-rules` paths + optional remote bundle.
- **FR-002**: System MUST match Semgrep-subset fields: `pattern-regex`, `pattern`, `patterns`, `pattern-either`.
- **FR-003**: System MUST run Shannon entropy analysis on assignment-like candidates with threshold, min length, and confidence filter.
- **FR-004**: Defaults MUST be: entropy threshold `4.2`, min length `12`, min confidence `low`, remote cache TTL `24h`, default rules on.
- **FR-005**: System MUST merge/deduplicate rule vs entropy findings (`rule+entropy` when correlated).
- **FR-006**: System MUST skip lockfile-noise keys and path-only registry URLs.
- **FR-007**: Remote fetch MUST use checksum metadata, TTL cache under `.codefence/cache/secret-rules/`, and honor `--secret-rules-refresh`.
- **FR-008**: System MUST embed builtin pack equivalent to `rules/secret/builtin.yml`, preserving rule IDs including: `secret-github-token`, `secret-gitlab-token`, `secret-stripe-key`, `secret-bearer-token`, `secret-private-key`, `secret-password-assignment`, `secret-uri-credentials`, `no-hardcoded-secret` (and any others present in the YAML). Keep pack version string in YAML comment / embed meta.
- **FR-009**: Compile all active regexes once per process; MCP keeps compiled set across tool calls; CLI lazy-loads only when `code` aspect runs; do not parse remote YAML on every file.
- **FR-010**: Evidence strings MUST NOT write full secrets to logs (truncate).
- **FR-011**: CLI/env/config flags for secrets are those specified in feature `001` / `002` (including `--secret-rules`, `--secret-default-rules`, `--secret-rules-update-url`, `--secret-rules-refresh`, `--secret-rules-cache-ttl`, `--secret-entropy-threshold`, `--secret-min-length`, `--secret-min-confidence`).

### Defaults table

| Option | Default |
| ------ | ------- |
| default rules | on |
| entropy threshold | `4.2` |
| min length | `12` |
| min confidence | `low` |
| remote cache TTL | `24h` |

### Non-goals

- Full Semgrep feature set beyond the documented subset.
- Network listeners or background secret scanning outside the `code` aspect.
- Changing builtin rule IDs without migration.

## Success criteria

- **SC-001**: YAML subset parser documented with supported fields list.
- **SC-002**: Builtin embed + version present; fixture tests under `testdata/secrets` (and/or `examples/secrets`) green.
- **SC-003**: Entropy lockfile skip, merge/dedup, cache TTL/refresh, and actionable YAML errors covered by tests.
- **SC-004**: Flags/env/config wired without inventing names.
- **SC-005**: Lazy load and once-per-process compile satisfy NFR startup design for secrets.

## Assumptions

- Finding schema from feature `003`; `code` aspect orchestration from `005` / `006`.
- Shared YAML dependency justified under NFR allowlist (same YAML stack as config if possible).

## Open questions

_(none beyond documenting the exact supported-field list)_

## References

- Builtin: [`rules/secret/builtin.yml`](../../../rules/secret/builtin.yml)
- Related: `001-cli-and-commands`, `002-config-and-env`, `006-secure-coding-rules`
- Global: [`nfr.md`](../../global/nfr.md), constitution § V–VI
