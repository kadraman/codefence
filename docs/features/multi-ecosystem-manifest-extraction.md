---
title: "Multi-Ecosystem Manifest Extraction"
status: proposed
owners: ["@kadraman"]
created: 2026-05-27
updated: 2026-05-27
issue: "TBD"
scope: "scan|deps|docs"
---

## Summary

Extend Codefence dependency extraction so each **language manifest** listed in `src/manifests.ts` produces OSV-queryable `(ecosystem, name, version)` coordinates—not only npm `package.json` with exact semver. Parsers should plug into the existing `deps` aspect, OSV `querybatch` client, cache, and finding output without new CLI aspects. Work is delivered **incrementally by ecosystem**; npm lockfile resolution remains a separate, npm-focused effort in [lockfile-aware-dependency-extraction.md](./lockfile-aware-dependency-extraction.md).

## Problem Statement

Today:

1. **Triggers without extraction** — `isDependencyManifest` recognizes many file types (`go.mod`, `pyproject.toml`, `pom.xml`, `.csproj`, …), and `--deps-scope tree` can discover them, but `extractDependenciesForManifest` only implements **`package.json`** (exact versions).
2. **False skips** — Users see `[deps] SKIPPED — No exact-version dependencies extracted` when only non-npm manifests change.
3. **Polyglot repos** — Teams running Python, Go, Java, or .NET alongside Node get no dependency vulnerability signal from Codefence unless they also change a pinned npm manifest.
4. **OSV already supports these ecosystems** — The provider sends `package.ecosystem` and `version` per query; the gap is local parsing, not the API.

Related but **out of scope for this feature** (separate specs):

- npm lockfiles: [lockfile-aware-dependency-extraction.md](./lockfile-aware-dependency-extraction.md)
- OSV transport, cache, severity: [vulnerable-dependency-scanning-osv.md](./vulnerable-dependency-scanning-osv.md)

## Proposed Solution

### Behavior

For each manifest path in scan scope (git-changed, `--paths`, or `--deps-scope tree`):

1. Dispatch to an **ecosystem extractor** by manifest basename (and extension for `.sln` / `.csproj`).
2. Emit `DependencyCoordinate[]` with correct OSV **ecosystem** string, **package name**, **exact version**, **manifestPath**, and **manifestLine** (best effort).
3. Skip unresolved ranges when no lockfile parser exists yet; log a single-line hint (for example “pin versions or commit a lockfile”).
4. Reuse deduplication: `ecosystem:name:version:manifestPath`.
5. Invalid/unparseable files: warn and continue; do not fail the whole scan.

No change to finding schema, exit codes, or `--format json` shape.

### OSV ecosystem mapping

Use [OSV supported ecosystems](https://google.github.io/osv.dev/) names in `DependencyCoordinate.ecosystem`:

| Language / tool | Manifest(s) in Codefence | Primary OSV ecosystem | Lockfile / resolved source (preferred) |
| --------------- | ------------------------ | --------------------- | -------------------------------------- |
| Node.js | `package.json` | `npm` | npm lockfiles (separate feature) |
| Python | `requirements.txt` | `PyPI` | Pinned `==` lines; later `Pipfile.lock` / `poetry.lock` |
| Python | `Pipfile` | `PyPI` | `Pipfile.lock` when present |
| Python | `pyproject.toml` | `PyPI` | `poetry.lock` or PEP 621 exact pins |
| Go | `go.mod` | `Go` | `go.sum` optional checksum pass; module `@version` in `go.mod` |
| Rust | `Cargo.toml` | `crates.io` | `Cargo.lock` |
| Ruby | `Gemfile` | `RubyGems` | `Gemfile.lock` |
| PHP | `composer.json` | `Packagist` | `composer.lock` (future) |
| Java (Maven) | `pom.xml` | `Maven` | Resolved `${revision}` / BOM imports v2 |
| Java (Gradle) | `build.gradle`, `build.gradle.kts` | `Maven` | Gradle lockfiles v2 |
| .NET | `packages.config`, `*.csproj`, `*.sln` | `NuGet` | `packages.lock.json` / project assets v2 |
| Swift | `Package.swift` | `SwiftURL` (confirm OSV name) | `Package.resolved` v2 |

**Note:** Confirm exact OSV ecosystem strings against the API before each parser ships; add a single `OSV_ECOSYSTEM` constant per extractor module.

### Manifest inventory (from `src/manifests.ts`)

| File | Tier | Extraction v1 target |
| ---- | ---- | -------------------- |
| `package.json` | — | **Done** (exact semver only) |
| `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` | npm | [Lockfile feature](./lockfile-aware-dependency-extraction.md) |
| `requirements.txt` | 1 | Lines matching `name==version` |
| `go.mod` | 1 | `require module path vX.Y.Z` (non-indirect) |
| `Gemfile` | 2 | Exact pins only; else `Gemfile.lock` |
| `composer.json` | 2 | `require` with exact versions |
| `pyproject.toml` | 2 | `[project.dependencies]` exact pins |
| `Pipfile` | 2 | Defer to `Pipfile.lock` parser |
| `poetry.lock`, `Pipfile.lock`, `Cargo.lock`, `Gemfile.lock`, `go.sum` | 2–3 | Lockfile parsers (may share patterns with npm lock work) |
| `pom.xml` | 3 | Dependencies with explicit `<version>` |
| `build.gradle`, `build.gradle.kts` | 3 | Limited: explicit `implementation "g:a:1.2.3"` |
| `packages.config`, `*.csproj` | 3 | `PackageReference` with `Version=` |
| `*.sln` | 3 | Discover referenced `.csproj` paths only (no OSV query on `.sln` itself) |
| `Package.swift` | 4 | `.exact("1.2.3")` pins; `Package.resolved` later |

Tiers are delivery order, not separate releases—ship parsers with tests as each stabilizes.

### Architecture

```
src/scan/deps/extract/
  index.ts              # extractDependenciesForManifest dispatcher
  packageJson.ts        # (move from extract.ts)
  requirementsTxt.ts
  goMod.ts
  ...
  types.ts              # shared helpers: normalizeVersion, findLine
```

1. **`extractDependenciesForManifest(path)`** — basename → extractor function.
2. **Per-ecosystem module** — pure functions, no network; unit-tested from fixtures.
3. **Optional `extractForProjectRoot(dir)`** — if manifest + lockfile coexist, apply precedence (same pattern as npm lockfile doc).
4. **Registry** — table-driven map `manifestBaseName → extractor` for easy checklist tracking.

### Merge and precedence (cross-file)

When multiple manifests describe the same project root `D`:

| Ecosystem | Prefer |
| --------- | ------ |
| Python | `poetry.lock` / `Pipfile.lock` over `pyproject.toml` / `Pipfile` |
| Go | `go.sum` does not replace `go.mod`; both may contribute validation later |
| Rust | `Cargo.lock` over `Cargo.toml` |
| Ruby | `Gemfile.lock` over `Gemfile` |
| .NET | `packages.lock.json` over `csproj` (future) |

v1 may implement **manifest-only** parsers first, then add lockfile parsers in the same ecosystem module.

### CLI surface

No new required flags for v1.

Optional later:

- `--deps-ecosystems <list>` — limit which ecosystems to extract (CI speed).
- `CODEFENCE_DEPS_ECOSYSTEMS` — same.

Existing flags continue to apply: `--only deps`, `--deps-scope tree`, `--deps-refresh`, etc.

### Config and environment

v1: none.

Optional later: `CODEFENCE_DEPS_ECOSYSTEMS=PyPI,Go,npm`.

### Examples

**Python `requirements.txt` (after Tier 1):**

```text
django==4.2.11
requests>=2.31.0
```

Extracts `PyPI` / `django` / `4.2.11` only; logs skip for ranged `requests` unless a lockfile is added later.

```bash
codefence scan --only deps --paths services/api/requirements.txt
```

**Go module:**

```bash
codefence scan --only deps --deps-scope tree --paths backend/
# discovers backend/go.mod → queries OSV Go ecosystem
```

**Polyglot monorepo audit:**

```bash
codefence scan --only deps --deps-scope tree
```

## Implementation Plan

### Areas touched

| Area | Change |
| ---- | ------ |
| `src/scan/deps/extract.ts` | Split into `extract/` package; dispatcher |
| `src/scan/deps/extract/*.ts` | New ecosystem parsers |
| `src/manifests.ts` | Document-only unless new basenames added |
| `src/scan/aspects/deps.ts` | Optional clearer skip messages per ecosystem |
| `tests/fixtures/manifests/<ecosystem>/` | Minimal real-world snippets |
| `tests/depsExtraction*.test.ts` | Per-parser tests |
| `examples/deps/` | Optional non-npm fixtures |
| `README.md` | Supported ecosystems table |

### Step-by-step plan

1. Refactor `extract.ts` → `extract/index.ts` + `extract/packageJson.ts` (no behavior change).
2. Add `extract/registry.ts` mapping basename → extractor.
3. **Tier 1:** `requirements.txt`, `go.mod` parsers + fixtures + tests.
4. **Tier 2:** `composer.json`, `Gemfile` (+ `Gemfile.lock`), `pyproject.toml` (+ `poetry.lock` if feasible).
5. **Tier 3:** `pom.xml`, Gradle Kotlin/Groovy subset, `.csproj` / `packages.config`.
6. **Tier 4:** `Package.swift`, `.sln` project reference discovery.
7. Update [vulnerable-dependency-scanning-osv.md](./vulnerable-dependency-scanning-osv.md) checklist as each tier lands.
8. Document supported ecosystems in README.

### Backward compatibility

Fully backward compatible: new parsers only add coordinates; npm `package.json` behavior unchanged unless lockfile feature merges precedence rules.

### Security considerations

| Risk | Mitigation |
| ---- | ---------- |
| Parser bugs → missed CVEs | Golden-file tests per ecosystem; start conservative (exact pins only) |
| Malicious manifest bombs (XML, huge lockfiles) | Size limits; streaming where possible; skip + warn |
| Wrong ecosystem string → empty OSV results | Contract test: fixture version known vulnerable in OSV |
| XXE / billion laughs in `pom.xml` | Use safe XML parser settings; disable DTDs |

## Testing Strategy

### Unit tests

Per extractor:

1. Minimal valid manifest → expected coordinates.
2. Ranged/unpinned specs → empty or lockfile fallback.
3. Malformed file → `[]` + no throw.
4. Line number spot-check for one dependency.

Suggested layout:

```text
tests/fixtures/manifests/requirements/simple.txt
tests/fixtures/manifests/go/simple/go.mod
tests/depsExtractionGo.test.ts
tests/depsExtractionPython.test.ts
```

### Integration tests

1. Stub OSV batch; assert `ecosystem` in query payload matches parser.
2. `runScan --only deps --paths <fixture>` exits `1` when fixture pins a known vulnerable version (optional live OSV job in CI).

### Required validation

```bash
npm test
npm run codefence
```

## Migration Path

1. Ship ecosystems tier-by-tier; release notes list newly supported manifests.
2. No user config required; polyglot repos start getting findings as parsers land.
3. Teams with only npm today see no regression.

## Implementation Checklist

### Foundation

- [ ] Refactor `extract/` module layout and registry dispatcher
- [ ] Document OSV ecosystem string per parser in code constants
- [ ] Shared version-normalization helpers (strip `v` prefix where applicable)

### Tier 1 — Python + Go

- [ ] `requirements.txt` — `==` pins → `PyPI`
- [ ] `go.mod` — `require` lines with semver → `Go`
- [ ] Fixtures and unit tests
- [ ] README ecosystem row

### Tier 2 — Ruby, PHP, Python (project files)

- [ ] `composer.json` — exact `require` versions → `Packagist`
- [ ] `Gemfile` exact pins; `Gemfile.lock` resolved versions → `RubyGems`
- [ ] `pyproject.toml` — PEP 621 exact pins → `PyPI`
- [ ] `poetry.lock` / `Pipfile.lock` parsers (or defer with clear skip message)
- [ ] Fixtures and tests

### Tier 3 — JVM + .NET

- [ ] `pom.xml` — explicit dependency versions → `Maven`
- [ ] `build.gradle` / `build.gradle.kts` — literal version strings → `Maven`
- [ ] `packages.config` — `package id="..." version="..."` → `NuGet`
- [ ] `*.csproj` — `PackageReference` with `Version` → `NuGet`
- [ ] `*.sln` — resolve project paths (or skip with doc)
- [ ] Fixtures and tests

### Tier 4 — Swift and hard cases

- [ ] `Package.swift` — `.exact("x.y.z")` → confirm OSV `SwiftURL` / ecosystem name
- [ ] `Package.resolved` parser (optional)
- [ ] Gradle/Maven BOM and property indirection (explicitly deferred or partial)

### Docs and release

- [ ] Update [vulnerable-dependency-scanning-osv.md](./vulnerable-dependency-scanning-osv.md) open checklist
- [ ] `npm test` / `npm run codefence` pass
- [ ] User-facing README supported-manifest table

## Future Enhancements

1. Lockfile parsers shared across ecosystems (see also npm [lockfile doc](./lockfile-aware-dependency-extraction.md))
2. `--deps-ecosystems` filter for large monorepos
3. Workspace-aware extraction (npm workspaces, Go workspaces, Poetry monorepo)
4. Private registry aliases in manifests (name mapping only; auth stays out of band)
5. OSV “query by commit” for Go pseudo-versions (advanced)

## Open Questions

1. **OSV ecosystem for Swift** — Confirm `SwiftURL` vs other identifier in production API.
2. **Gradle** — Support Groovy DSL only, or Kotlin DSL first? How much of dynamic resolution is v1?
3. **`.sln`** — Extract only project references, or require scanning each `.csproj` in tree mode?
4. **Tier order** — Prioritize Go/Python (Tier 1) vs JVM (.NET-heavy enterprise)?
5. **Live vs stubbed OSV in CI** — One optional integration job per ecosystem?
6. **pyproject.toml** — Support Poetry only, or also Hatch/PDM `[project]` tables in v1?

## References

1. [Vulnerable Dependency Scanning With OSV](./vulnerable-dependency-scanning-osv.md)
2. [Lockfile-aware dependency extraction (npm)](./lockfile-aware-dependency-extraction.md)
3. `src/manifests.ts` — triggered manifest basenames
4. `src/scan/deps/extract.ts` — current npm-only extraction
5. [OSV supported ecosystems](https://google.github.io/osv.dev/)
6. [OSV query API](https://google.github.io/osv.dev/api/)

## Additional Notes

- Prefer **small, exact-pin parsers** over full package-manager emulation; lockfiles are the source of truth for ranges.
- Each ecosystem should be shippable independently—avoid a big-bang release.
- When a manifest type is triggered but not yet implemented, improve the skip message: `No extractor for pom.xml yet` instead of a generic “no exact-version” message (optional UX follow-up).
