# Dependency scanning support matrix

Codefence dependency scanning has two layers:

1. **Trigger** — Changing the file (or including it via `--deps-scope tree`) can auto-run the `deps` aspect and OSV lookup when versions are extracted.
2. **Extraction** — The scanner produces `(ecosystem, name, version)` coordinates for the OSV batch API.

Implementation source of truth: [`src/manifests.ts`](../src/manifests.ts) (triggers) and [`src/scan/deps/extract.ts`](../src/scan/deps/extract.ts) (extraction dispatch). This page is the user-facing summary; design details live in the linked feature specs.

## Summary by ecosystem

| Ecosystem | OSV ecosystem | Trigger | Version extraction | Lockfile / resolved versions |
| --------- | ------------- | ------- | ------------------ | ---------------------------- |
| **Node.js (npm)** | `npm` | Yes | **Shipped** | `package-lock.json` (v2/v3), `yarn.lock` (Classic), `pnpm-lock.yaml` |
| Python | `PyPI` | Yes | **Shipped** (`requirements.txt`, `Pipfile`, `pyproject.toml`) | `poetry.lock`, `Pipfile.lock`, `uv.lock` |
| Go | `Go` | Yes | **Shipped** (`go.mod`) | `go.sum` (checksum companion; not used for versions yet) |
| Rust | `crates.io` | Yes | **Shipped** (`Cargo.toml`, `Cargo.lock`) | Exact `=` pins in Cargo.toml; `Cargo.lock` wins when in scope |
| Ruby | `RubyGems` | Yes | **Shipped** (`Gemfile`, `Gemfile.lock`) | Exact pins in Gemfile; lockfile wins when in scope |
| PHP | `Packagist` | Yes | **Shipped** (`composer.json`) | Exact `require` / `require-dev` versions; `composer.lock` planned |
| JVM (Maven coordinates) | `Maven` | Yes | **Shipped** (`pom.xml`, `build.gradle`, `build.gradle.kts`) | Explicit versions / literal GAV strings; BOMs and property indirection deferred |
| .NET (NuGet) | `NuGet` | Yes | **Shipped** (`*.csproj`, `packages.config`, `*.sln` → `.csproj`) | `packages.lock.json` planned |
| Swift | `SwiftURL` (TBD) | Yes | Planned | `Package.swift` |

Provider, cache, and CLI behavior: [vulnerable-dependency-scanning-osv.md](features/vulnerable-dependency-scanning-osv.md).

## npm (shipped)

| Manifest | Triggers `deps` | Extracts versions | Notes |
| -------- | --------------- | ----------------- | ----- |
| `package.json` | Yes | Exact pins only | Ranges (`^`, `~`, `*`) are skipped unless a sibling lockfile is in scope |
| `package-lock.json` | Yes | Yes (v2/v3) | Legacy v1 unsupported; 10 MiB read cap with warning |
| `yarn.lock` | Yes | Yes (Classic) | Yarn Berry (`__metadata`) warns and yields no coordinates |
| `pnpm-lock.yaml` | Yes | Yes | All importers/packages in file when lockfile is in scope |

**Merge rules** (same directory): if multiple lockfiles are in scope, use `pnpm-lock.yaml` → `package-lock.json` → `yarn.lock` (one-line warning). When any preferred lockfile is in scope, lockfile versions win over ranged `package.json` entries. Details: [lockfile-aware-dependency-extraction.md](features/implemented/lockfile-aware-dependency-extraction.md).

## Python, Go (shipped)

| Manifest | Ecosystem | Notes |
| -------- | --------- | ----- |
| `requirements.txt` | PyPI | `name==version` pins; recursive `-r` includes |
| `Pipfile` | PyPI | Exact `==` pins in `[packages]` / `[dev-packages]` |
| `pyproject.toml` | PyPI | PEP 621 `[project]` exact `==` pins |
| `Pipfile.lock`, `poetry.lock`, `uv.lock` | PyPI | Resolved registry packages |
| `go.mod` | Go | `require` lines with semver (`v` prefix stripped for OSV); pseudo-versions skipped |
| `go.sum` | Go | Trigger only (checksum companion; no version extraction) |

**Merge rules** (same directory): prefer `Pipfile.lock` over `Pipfile`; `uv.lock` over `poetry.lock` over `pyproject.toml` (warning when multiple Python lockfiles are in scope). `requirements.txt` is always scanned when in scope.

## Ruby (shipped)

| Manifest | Triggers `deps` | Extracts versions | Notes |
| -------- | --------------- | ----------------- | ----- |
| `Gemfile` | Yes | Exact pins only | `gem 'name', '1.2.3'`; ranges (`~>`, `>=`, …) skipped unless `Gemfile.lock` is in scope |
| `Gemfile.lock` | Yes | Yes | Resolved `name (version)` specs; nested `name (= version)` lines; 10 MiB read cap |

**Merge rules** (same directory): when `Gemfile.lock` is in scope, it is used instead of `Gemfile` for that project root. If only `Gemfile` is in scope but `Gemfile.lock` exists on disk, Codefence warns that ranged entries may be skipped.

Fixtures: [examples/deps/ruby/](../examples/deps/ruby/).

## PHP (shipped)

| Manifest | Triggers `deps` | Extracts versions | Notes |
| -------- | --------------- | ----------------- | ----- |
| `composer.json` | Yes | Exact pins only | `require` and `require-dev` with literal versions; skips `php`, `ext-*`, `lib-*`, and constraint ranges (`^`, `~`, `*`, …) |

`composer.lock` is not parsed yet (planned). Fixtures: [examples/deps/php/](../examples/deps/php/).

## .NET / NuGet (shipped)

| Manifest | Triggers `deps` | Extracts versions | Notes |
| -------- | --------------- | ----------------- | ----- |
| `*.csproj` | Yes | Yes | `PackageReference` with `Version="…"` on the tag or child `<Version>…</Version>`; skips ranges, floating versions, and `Update`-only entries |
| `packages.config` | Yes | Yes | Legacy pinned `package id="…" version="…"` entries; skips ranges |
| `*.sln` | Yes | Yes (via `.csproj`) | Discovers referenced `.csproj` paths and extracts from those projects (coordinates use the `.csproj` path) |

`packages.lock.json` / project assets are not parsed yet. Fixtures: [examples/deps/dotnet/](../examples/deps/dotnet/).

## JVM / Maven (shipped — exact pins only)

| Manifest | Triggers `deps` | Extracts versions | Notes |
| -------- | --------------- | ----------------- | ----- |
| `pom.xml` | Yes | Yes | `<dependency>` entries with explicit `<version>`; skips `${property}` placeholders and ranges; ignores `<dependencyManagement>` |
| `build.gradle` | Yes | Yes | Literal `implementation "g:a:1.2.3"` / map `group/name/version` forms |
| `build.gradle.kts` | Yes | Yes | Literal `implementation("g:a:1.2.3")` and named-arg map forms |

OSV package names use `groupId:artifactId`. Property/BOM resolution and Gradle lockfiles are deferred. Fixtures: [examples/deps/jvm/](../examples/deps/jvm/).


## Rust / crates.io (shipped)

| Manifest | Triggers `deps` | Extracts versions | Notes |
| -------- | --------------- | ----------------- | ----- |
| `Cargo.toml` | Yes | Exact `=` pins only | Bare versions (`"1.2.3"`) are caret ranges and are skipped unless `Cargo.lock` is in scope |
| `Cargo.lock` | Yes | Yes | Resolved crates.io registry packages; path/git/workspace packages without a crates.io `source` are skipped |

**Merge rules** (same directory): when `Cargo.lock` is in scope, it is used instead of `Cargo.toml` for that project root. If only `Cargo.toml` is in scope but `Cargo.lock` exists on disk, Codefence warns that ranged entries may be skipped.

Fixtures: [examples/deps/rust/](../examples/deps/rust/).

## Trigger-only and planned manifests

These files are recognized in [`src/manifests.ts`](../src/manifests.ts) and can start a dependency scan, but have **no extractor** yet:

```text
[deps] SKIPPED — No dependency extractor for: Package.swift. See docs/dependency-support.md.
```

When an extractor exists but only ranged/unpinned entries are in scope:

```text
[deps] SKIPPED — No exact-version dependencies extracted from changed manifests.
```

| Manifest | Ecosystem | Status |
| -------- | --------- | ------ |
| `Package.swift` | SwiftURL | Planned |

Delivery order and OSV ecosystem strings: [multi-ecosystem-manifest-extraction.md](features/multi-ecosystem-manifest-extraction.md).

## Related documentation

| Document | Purpose |
| -------- | ------- |
| [lockfile-aware-dependency-extraction.md](features/implemented/lockfile-aware-dependency-extraction.md) | npm lockfile parsers (shipped) |
| [multi-ecosystem-manifest-extraction.md](features/multi-ecosystem-manifest-extraction.md) | Non-npm parsers (partial: Python, Go, Ruby, PHP, JVM, .NET, Rust shipped; Swift open) |
| [vulnerable-dependency-scanning-osv.md](features/vulnerable-dependency-scanning-osv.md) | OSV provider, cache, CLI, `--deps-scope tree` |

When adding a parser, update this matrix, the relevant feature spec checklist, and [`src/scan/deps/extract.ts`](../src/scan/deps/extract.ts) in the same change.
