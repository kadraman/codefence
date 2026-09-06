---
title: "Multi-Ecosystem Manifest Extraction"
status: implemented
owners: ["@kadraman"]
created: 2026-05-27
updated: 2026-09-06
issue: "TBD"
scope: "scan|deps|docs"
---

## Summary

Extend Codefence dependency extraction so each **language manifest** listed in `src/manifests.ts` produces OSV-queryable `(ecosystem, name, version)` coordinates—not only npm `package.json` with exact semver. Parsers should plug into the existing `deps` aspect, OSV `querybatch` client, cache, and finding output without new CLI aspects. Work is delivered **incrementally by ecosystem**; npm lockfile resolution is shipped separately — see [lockfile-aware-dependency-extraction.md](./lockfile-aware-dependency-extraction.md). Current trigger vs extraction status: [dependency-support.md](../../dependency-support.md).

## Problem Statement

**Shipped (2026-09-06):** npm (`package.json` + lockfiles), Python (`requirements.txt`, `Pipfile`, `pyproject.toml`, `Pipfile.lock`, `poetry.lock`, `uv.lock`), Go (`go.mod`), Ruby (`Gemfile`, `Gemfile.lock`), PHP (`composer.json`, `composer.lock`), JVM (`pom.xml`, `build.gradle`, `build.gradle.kts`), .NET (`*.csproj`, `packages.config`, `*.sln` → `.csproj`, `packages.lock.json`), Rust (`Cargo.toml`, `Cargo.lock`), and Swift (`Package.swift`, `Package.resolved`) — see [`src/scan/deps/extract.ts`](../../../src/scan/deps/extract.ts) and [dependency-support.md](../../dependency-support.md). Example fixtures: [examples/deps/](../../../examples/deps/).

**Remaining gaps:**

1. **Deferred hard cases** — Gradle/Maven BOM and property indirection remain out of scope for exact-pin v1 parsers ([#11](https://github.com/kadraman/codefence/issues/11)).
2. **Checksum companions** — `go.sum` triggers scans but does not contribute versions (checksum companion only).
3. **Optional filters** — `--deps-ecosystems` / `CODEFENCE_DEPS_ECOSYSTEMS` are still future enhancements ([#12](https://github.com/kadraman/codefence/issues/12)).

Related but **out of scope for this feature** (separate specs):

- npm lockfiles: [lockfile-aware-dependency-extraction.md](./lockfile-aware-dependency-extraction.md)
- OSV transport, cache, severity: [vulnerable-dependency-scanning-osv.md](../vulnerable-dependency-scanning-osv.md)

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
| Python | `requirements.txt` | `PyPI` | **Shipped:** `==` pins; recursive `-r` |
| Python | `Pipfile` | `PyPI` | **Shipped:** exact `==` pins; prefer `Pipfile.lock` in scope |
| Python | `pyproject.toml` | `PyPI` | **Shipped:** PEP 621 exact pins; prefer `poetry.lock` / `uv.lock` |
| Python | `Pipfile.lock`, `poetry.lock`, `uv.lock` | `PyPI` | **Shipped** |
| Go | `go.mod` | `Go` | **Shipped:** `require` lines with semver (pseudo-versions skipped) |
| Rust | `Cargo.toml` | `crates.io` | **Shipped:** exact `=` pins; prefer `Cargo.lock` in scope |
| Ruby | `Gemfile` | `RubyGems` | **Shipped:** exact pins; prefer `Gemfile.lock` in scope |
| Ruby | `Gemfile.lock` | `RubyGems` | **Shipped** |
| PHP | `composer.json` | `Packagist` | **Shipped:** exact `require` / `require-dev` |
| PHP | `composer.lock` | `Packagist` | **Shipped** |
| Java (Maven) | `pom.xml` | `Maven` | **Shipped:** explicit `<version>`; `${revision}` / BOM imports deferred |
| Java (Gradle) | `build.gradle`, `build.gradle.kts` | `Maven` | **Shipped:** literal GAV strings; Gradle lockfiles deferred |
| .NET | `*.csproj` | `NuGet` | **Shipped:** `PackageReference` with `Version` |
| .NET | `packages.config`, `*.sln`, `packages.lock.json` | `NuGet` | **Shipped:** `packages.config` pins; `.sln` → `.csproj`; lockfile preferred |
| Swift | `Package.swift` | `SwiftURL` | **Shipped:** `.exact("…")` / `exact:` pins; prefer `Package.resolved` |
| Swift | `Package.resolved` | `SwiftURL` | **Shipped:** resolved pins with normalized Git URL names |

**Note:** Confirm exact OSV ecosystem strings against the API before each parser ships; add a single `OSV_ECOSYSTEM` constant per extractor module.

### Manifest inventory (from `src/manifests.ts`)

| File | Tier | Extraction status |
| ---- | ---- | ----------------- |
| `package.json` | — | **Done** (exact semver only) |
| `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` | npm | **Done** — [lockfile feature](./lockfile-aware-dependency-extraction.md) |
| `requirements.txt` | 1 | **Done** — `name==version` |
| `go.mod` | 1 | **Done** — `require` with semver (`v` prefix stripped for OSV) |
| `Pipfile` | 2 | **Done** — exact `==` pins |
| `pyproject.toml` | 2 | **Done** — PEP 621 exact pins |
| `Pipfile.lock`, `poetry.lock`, `uv.lock` | 2 | **Done** |
| `Gemfile` | 2 | **Done** — exact pins |
| `Gemfile.lock` | 2 | **Done** |
| `composer.json` | 2 | **Done** — exact `require` versions |
| `Cargo.lock` | 2–3 | **Done** |
| `go.sum` | 2–3 | Trigger only — checksum companion (no version extraction) |
| `composer.lock` | 2–3 | **Done** |
| `pom.xml` | 3 | **Done** — dependencies with explicit `<version>` |
| `build.gradle`, `build.gradle.kts` | 3 | **Done** — literal `implementation "g:a:1.2.3"` / map forms |
| `packages.config` | 3 | **Done** — pinned `package` entries |
| `*.csproj` | 3 | **Done** — `PackageReference` with `Version` attribute or child element |
| `*.sln` | 3 | **Done** — discover referenced `.csproj` paths and extract |
| `packages.lock.json` | 3 | **Done** — resolved NuGet versions; preferred over sibling `.csproj` |
| `Package.swift` | 4 | **Done** — `.exact("1.2.3")` / `exact:` pins |
| `Package.resolved` | 4 | **Done** — resolved SwiftURL pins |

Tiers are delivery order, not separate releases—ship parsers with tests as each stabilizes.

### Architecture (current)

```
src/scan/deps/extract.ts           # table-driven dispatcher (basename → extractor)
src/scan/deps/extract/
  shared.ts, packageLock.ts, yarnLock.ts, pnpmLock.ts   # npm lockfiles
  requirementsTxt.ts, pipfile.ts, pyprojectToml.ts     # Python
  pipfileLock.ts, poetryLock.ts, uvLock.ts
  goMod.ts, gemfile.ts, gemfileLock.ts                 # Ruby
  composerJson.ts, composerLock.ts                     # PHP
  csproj.ts, packagesConfig.ts, packagesLockJson.ts, sln.ts  # .NET
  pomXml.ts, gradle.ts                                   # JVM
  cargoToml.ts, cargoLock.ts                             # Rust
  packageSwift.ts, packageResolved.ts                    # Swift
  manifestSupport.ts                                     # extractor registry / skip messages
```

1. **`extractDependenciesForManifest(path)`** in [`extract.ts`](../../../src/scan/deps/extract.ts) — basename → extractor via `BASENAME_EXTRACTORS` (extension handlers for `.sln` / `.csproj`).
2. **Per-ecosystem module** — pure functions under `extract/`; covered in `tests/depsExtraction.test.ts`.
3. **Optional `extractForProjectRoot(dir)`** — npm, Python, Ruby, Rust, PHP, Swift, and .NET use lockfile precedence in the `deps` aspect.
4. **Registry** — table-driven `manifestBaseName → extractor` in `extract.ts`.

### Merge and precedence (cross-file)

When multiple manifests describe the same project root `D`:

| Ecosystem | Prefer |
| --------- | ------ |
| Python | `poetry.lock` / `Pipfile.lock` over `pyproject.toml` / `Pipfile` |
| Go | `go.sum` does not replace `go.mod`; both may contribute validation later |
| Rust | `Cargo.lock` over `Cargo.toml` |
| Ruby | `Gemfile.lock` over `Gemfile` (**shipped** in `deps` aspect) |
| PHP | `composer.lock` over `composer.json` |
| Swift | `Package.resolved` over `Package.swift` |
| .NET | `packages.lock.json` over sibling `.csproj` |

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
7. Update [vulnerable-dependency-scanning-osv.md](../vulnerable-dependency-scanning-osv.md) checklist as each tier lands.
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

- [x] `extract/` per-ecosystem modules and dispatcher in `extract.ts`
- [x] OSV ecosystem constants per parser (`NPM_ECOSYSTEM`, `GO_ECOSYSTEM`, PyPI in Python modules)
- [x] Shared helpers in `extract/shared.ts` (version normalization, dedupe, read caps)
- [x] Table-driven registry dispatcher (`BASENAME_EXTRACTORS` in `extract.ts`)

### Tier 1 — Python + Go

- [x] `requirements.txt` — `==` pins → `PyPI`
- [x] `go.mod` — `require` lines with semver → `Go`
- [x] `Pipfile` — `[packages]` / `[dev-packages]` exact `==` pins → `PyPI`
- [x] Fixtures and unit tests (`tests/depsExtraction.test.ts`, `examples/deps`)
- [x] [dependency-support.md](../../dependency-support.md) ecosystem rows

### Tier 2 — Ruby, PHP, Python (remaining)

- [x] `composer.json` — exact `require` versions → `Packagist`
- [x] `composer.lock` — resolved packages → `Packagist`
- [x] `Gemfile` exact pins; `Gemfile.lock` resolved versions → `RubyGems`
- [x] `pyproject.toml` — PEP 621 exact pins → `PyPI`
- [x] `poetry.lock` / `Pipfile.lock` / `uv.lock` → `PyPI`
- [x] Fixtures and tests for Ruby/PHP (`examples/deps/ruby`, `examples/deps/php`, `tests/depsExamples.test.ts`)

### Tier 3 — JVM + .NET

- [x] `pom.xml` — explicit dependency versions → `Maven`
- [x] `build.gradle` / `build.gradle.kts` — literal version strings → `Maven`
- [x] `packages.config` — `package id="..." version="..."` → `NuGet`
- [x] `*.csproj` — `PackageReference` with `Version` → `NuGet`
- [x] `*.sln` — resolve project paths and extract from `.csproj`
- [x] `packages.lock.json` — resolved NuGet versions → `NuGet`
- [x] .NET / JVM fixtures (`examples/deps/dotnet/`, `examples/deps/jvm/`) and `tests/depsExamples.test.ts`

### Tier 4 — Rust + Swift

- [x] `Cargo.toml` — exact `=` pins → `crates.io`
- [x] `Cargo.lock` — crates.io registry packages → `crates.io`
- [x] Fixtures and tests (`examples/deps/rust/`, `tests/depsExtraction.test.ts`, `tests/depsExamples.test.ts`)
- [x] `Package.swift` — `.exact("x.y.z")` / `exact:` → `SwiftURL` (`github.com/...` names)
- [x] `Package.resolved` parser → `SwiftURL`
- [ ] Gradle/Maven BOM and property indirection (explicitly deferred)

### Docs and release

- [x] Update [vulnerable-dependency-scanning-osv.md](../vulnerable-dependency-scanning-osv.md) checklist (2026-06-01)
- [x] `npm test` / `npm run codefence` pass (CI/local)
- [x] User-facing matrix in [dependency-support.md](../../dependency-support.md); README links to it

## Future Enhancements

1. Lockfile parsers shared across ecosystems (see also npm [lockfile doc](./lockfile-aware-dependency-extraction.md))
2. `--deps-ecosystems` filter for large monorepos ([#12](https://github.com/kadraman/codefence/issues/12))
3. Workspace-aware extraction (npm workspaces, Go workspaces, Poetry monorepo)
4. Private registry aliases in manifests (name mapping only; auth stays out of band)
5. OSV “query by commit” for Go pseudo-versions (advanced)
6. Gradle/Maven BOM and property resolution ([#11](https://github.com/kadraman/codefence/issues/11))

## Open Questions

1. ~~**OSV ecosystem for Swift** — Confirm `SwiftURL` vs other identifier in production API.~~ **Resolved:** use `SwiftURL` with normalized Git URL names (`github.com/org/repo`).
2. ~~**Gradle** — Support Groovy DSL only, or Kotlin DSL first? How much of dynamic resolution is v1?~~ **Resolved:** both Groovy and Kotlin literal forms shipped; dynamic/BOM deferred.
3. ~~**`.sln`** — Extract only project references, or require scanning each `.csproj` in tree mode?~~ **Resolved:** `.sln` discovers referenced `.csproj` paths.
4. ~~**Tier order** — Prioritize Go/Python (Tier 1) vs JVM (.NET-heavy enterprise)?~~ **Resolved:** delivered tier-by-tier as listed.
5. **Live vs stubbed OSV in CI** — One optional integration job per ecosystem?
6. ~~**pyproject.toml** — Support Poetry only, or also Hatch/PDM `[project]` tables in v1?~~ **Resolved:** PEP 621 `[project]` / `[project.optional-dependencies]` exact `==` pins shipped; Poetry-specific tables beyond that remain incremental.

## References

1. [Vulnerable Dependency Scanning With OSV](../vulnerable-dependency-scanning-osv.md)
2. [Lockfile-aware dependency extraction (npm)](./lockfile-aware-dependency-extraction.md)
3. `src/manifests.ts` — triggered manifest basenames
4. `src/scan/deps/extract.ts` — dispatcher (all listed ecosystems shipped; `go.sum` remains trigger-only)
5. [OSV supported ecosystems](https://google.github.io/osv.dev/)
6. [OSV query API](https://google.github.io/osv.dev/api/)

## Additional Notes

- Prefer **small, exact-pin parsers** over full package-manager emulation; lockfiles are the source of truth for ranges.
- Each ecosystem should be shippable independently—avoid a big-bang release.
- ~~When a manifest type is triggered but not yet implemented, improve the skip message~~ **Shipped:** `buildDepsSkipMessage` lists manifests without extractors (for example `go.sum`).
