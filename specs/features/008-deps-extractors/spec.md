---
title: "Deps Extractors"
id: 8
slug: "deps-extractors"
status: specified
authors: ["@kadraman"]
created: 2026-09-19
updated: 2026-09-19
issue: "https://github.com/kadraman/codefence/issues/8"
area: deps
---

# Feature Specification: Deps Extractors

## Summary

Implement manifest triggers and version extraction for the **MVP ecosystem matrix** (JavaScript/TypeScript via npm, and Go). Prefer lockfiles over ranged manifests using the merge precedence rules below. Enforce a **10 MiB** lockfile read cap with warning. OSV queries need exact versions; extractors MUST follow the MVP matrix. Additional ecosystems are **post-MVP roadmap** (not required to complete this feature).

## Problem

Without faithful extraction for the ecosystems agents actually use first (JS/TS and Go), the `deps` aspect cannot produce accurate OSV coordinates. Expanding to every package manager before MVP ships delays the core loop.

## User scenarios

### User Story 1 — Trigger vs extraction (Priority: P1)

**Why this priority**: Distinguishing trigger files from extractable manifests drives aspect enablement vs OSV input.

**Independent test**: Discovery/trigger tests vs extractor table tests.

**Acceptance scenarios**:

1. **Given** a file change / tree discovery hit on a trigger or extractable manifest, **When** orchestration evaluates deps, **Then** that file can enable `deps` (trigger semantics; orchestration in feature `005`).
2. **Given** an extractable manifest or lockfile in scope, **When** extraction runs, **Then** package coordinates suitable for OSV are produced (ecosystem + name + version).

### User Story 2 — MVP ecosystem matrix and lock preference (Priority: P1)

**Why this priority**: npm + Go are the MVP definition of done for extractors.

**Independent test**: Table tests per extractor; golden coordinate JSON.

**Acceptance scenarios**:

1. **Given** each ecosystem in the MVP matrix below, **When** its listed manifests are extracted, **Then** OSV ecosystem IDs and coordinates match the matrix.
2. **Given** a Node lockfile and a ranged `package.json` both in scope, **When** merge precedence applies, **Then** lockfiles win: `pnpm-lock.yaml` → `package-lock.json` → `yarn.lock`.
3. **Given** only version ranges without a lockfile supplying resolved versions, **When** extracting, **Then** ranges are skipped.
4. **Given** only a ranged manifest is in scope but a lockfile exists on disk, **When** extracting, **Then** a warning is emitted.
5. **Given** Yarn Berry lockfiles for Node, **When** extracting, **Then** warn/empty (Classic `yarn.lock` supported).
6. **Given** Go `go.sum`, **When** classifying, **Then** it is trigger-only (extraction from `go.mod`).

### User Story 3 — Size cap and dispatch (Priority: P1)

**Why this priority**: 10 MiB cap is an NFR hard constraint and DoS guard.

**Acceptance scenarios**:

1. **Given** a lockfile larger than `MAX_LOCKFILE_BYTES = 10 MiB`, **When** reading for extraction, **Then** the read is capped and a warning is emitted.
2. **Given** a basename/extension for an MVP matrix manifest, **When** dispatching, **Then** the table matches the basename/extension matchers for that matrix.
3. **Given** a post-MVP roadmap manifest (e.g. `Cargo.toml`, `Gemfile`), **When** encountered in MVP, **Then** it does **not** extract coordinates (may be ignored or reported as unsupported — do not silently invent a parser).

### Edge cases

- What happens when multiple lockfiles of different Node package managers exist?
- Unrecognized / roadmap manifests must not produce fake coordinates.

## Requirements

### Functional requirements

- **FR-001**: System MUST separate **trigger** (enable `deps`) from **extraction** (produce OSV coordinates).
- **FR-002**: System MUST implement the **MVP ecosystem matrix** (table below).
- **FR-003**: System MUST skip version ranges unless a lockfile in scope supplies resolved versions.
- **FR-004**: System MUST warn when only a ranged manifest is in scope but a lockfile exists on disk.
- **FR-005**: System MUST enforce `MAX_LOCKFILE_BYTES = 10 MiB` with warning.
- **FR-006**: System MUST use a basename/dispatch table covering the MVP matrix manifests.
- **FR-007**: Extractors MUST live under `internal/scan/deps/extract/` in separate files for reviewability.
- **FR-008**: Prefer pure Go parsers; YAML lockfiles (pnpm, etc.) SHOULD share the YAML dependency with config/secrets if possible.
- **FR-009**: Post-MVP roadmap ecosystems MUST NOT be required to mark this feature complete; each later ecosystem needs its own accepted feature/spec slice before implementation.

### Ecosystem matrix (MVP required)

| Ecosystem | OSV ecosystem | Manifests (extract) | Notes |
| --------- | ------------- | ------------------- | ----- |
| JavaScript / TypeScript (Node) | `npm` | `package.json` (exact pins), `package-lock.json` v2/v3, `yarn.lock` Classic, `pnpm-lock.yaml` | Lock prefer: pnpm → npm → yarn; Yarn Berry warn/empty |
| Go | `Go` | `go.mod` | `go.sum` trigger-only |

### Post-MVP roadmap (not in MVP DoD)

Ship later as separate feature slices (order may change; suggested default):

| Wave | Ecosystem | OSV ecosystem | Manifests (extract) | Notes |
| ---- | --------- | ------------- | ------------------- | ----- |
| 2 | Python | `PyPI` | `requirements.txt`, `Pipfile`, `pyproject.toml`, `Pipfile.lock`, `poetry.lock`, `uv.lock` | Prefer Pipfile.lock over Pipfile; uv → poetry → pyproject |
| 3 | Rust | `crates.io` | `Cargo.toml`, `Cargo.lock` | Lock wins |
| 4 | Ruby | `RubyGems` | `Gemfile`, `Gemfile.lock` | Lock wins |
| 4 | PHP | `Packagist` | `composer.json`, `composer.lock` | Lock wins |
| 5 | JVM | `Maven` | `pom.xml`, `build.gradle`, `build.gradle.kts` | No BOM resolution in first JVM slice |
| 5 | .NET | `NuGet` | `*.csproj`, `packages.config`, `*.sln`→csproj, `packages.lock.json` | Lock preferred |
| 6 | Swift | `SwiftURL` | `Package.swift`, `Package.resolved` | Exact pins; lock preferred |

### Non-goals

- OSV HTTP client / vulnerability matching (feature `009-deps-scanning`).
- Implementing post-MVP roadmap ecosystems in this feature.
- BOM resolution for Maven/Gradle (when JVM ships).
- Inventing ecosystems beyond the tables above.

## Success criteria

- **SC-001**: Both MVP ecosystems extract correctly under tests.
- **SC-002**: Merge precedence tests exist for Node lock preference and Go trigger-only `go.sum`.
- **SC-003**: Size cap warnings covered by tests.
- **SC-004**: Discovery skip dirs remain consistent with feature `005` discovery.
- **SC-005**: Golden coordinate lists committed as JSON under `testdata/` for MVP ecosystems.
- **SC-006**: User docs (`docs/dependency-support.md`) list MVP as required and roadmap as later.

## Assumptions

- Manifest discovery skip dirs follow feature `005`.
- Fixtures under `examples/deps/**` (npm / Go first) feed `testdata/deps/`.

## Open questions

_(none for MVP scope)_

## References

- Related: `005-scan-orchestrator`, `009-deps-scanning`
- Global: [`nfr.md`](../../global/nfr.md) (10 MiB lockfile cap), [`testing.md`](../../global/testing.md)
- Docs: [`docs/dependency-support.md`](../../../docs/dependency-support.md)
- Examples: `examples/deps/**`
