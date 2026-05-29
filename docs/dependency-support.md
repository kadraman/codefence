# Dependency scanning support matrix

Codefence dependency scanning has two layers:

1. **Trigger** — Changing the file (or including it via `--deps-scope tree`) can auto-run the `deps` aspect and OSV lookup when versions are extracted.
2. **Extraction** — The scanner produces `(ecosystem, name, version)` coordinates for the OSV batch API.

Implementation source of truth: [`src/manifests.ts`](../src/manifests.ts) (triggers) and [`src/scan/deps/extract.ts`](../src/scan/deps/extract.ts) (extraction dispatch). This page is the user-facing summary; design details live in the linked feature specs.

## Summary by ecosystem

| Ecosystem | OSV ecosystem | Trigger | Version extraction | Lockfile / resolved versions |
| --------- | ------------- | ------- | ------------------ | ---------------------------- |
| **Node.js (npm)** | `npm` | Yes | **Shipped** | `package-lock.json` (v2/v3), `yarn.lock` (Classic), `pnpm-lock.yaml` |
| Python | `PyPI` | Yes | Planned | See [multi-ecosystem spec](features/multi-ecosystem-manifest-extraction.md) |
| Go | `Go` | Yes | Planned | `go.mod` / `go.sum` |
| Rust | `crates.io` | Yes | Planned | `Cargo.toml` / `Cargo.lock` |
| Ruby | `RubyGems` | Yes | Planned | `Gemfile` / `Gemfile.lock` |
| PHP | `Packagist` | Yes | Planned | `composer.json` |
| JVM (Maven coordinates) | `Maven` | Yes | Planned | `pom.xml`, `build.gradle`, `build.gradle.kts` |
| .NET (NuGet) | `NuGet` | Yes | Planned | `packages.config`, `*.csproj`, `*.sln` (discovery) |
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

## Other manifests (trigger only today)

These files are recognized in [`src/manifests.ts`](../src/manifests.ts) and can start a dependency scan, but `extractDependenciesForManifest` does not parse them yet. You may see:

```text
[deps] SKIPPED — No exact-version dependencies extracted from changed manifests.
```

| Manifest | Planned ecosystem | Planned extraction (tier) |
| -------- | ----------------- | --------------------------- |
| `requirements.txt` | PyPI | Pinned `==` lines (tier 1) |
| `go.mod` | Go | `require … vX.Y.Z` (tier 1) |
| `Gemfile` | RubyGems | Exact pins; `Gemfile.lock` (tier 2) |
| `composer.json` | Packagist | Exact `require` versions (tier 2) |
| `pyproject.toml` | PyPI | Exact PEP 621 pins (tier 2) |
| `Pipfile` | PyPI | Via `Pipfile.lock` (tier 2) |
| `poetry.lock` | PyPI | Lockfile parser (tier 2–3) |
| `Pipfile.lock` | PyPI | Lockfile parser (tier 2–3) |
| `Cargo.toml` | crates.io | Exact pins (tier 2) |
| `Cargo.lock` | crates.io | Lockfile parser (tier 2–3) |
| `Gemfile.lock` | RubyGems | Lockfile parser (tier 2–3) |
| `go.sum` | Go | Checksum companion (tier 2–3) |
| `pom.xml` | Maven | Explicit `<version>` (tier 3) |
| `build.gradle`, `build.gradle.kts` | Maven | Explicit coordinates (tier 3) |
| `packages.config` | NuGet | Pinned packages (tier 3) |
| `*.csproj` | NuGet | `PackageReference` with version (tier 3) |
| `*.sln` | — | Discover referenced `.csproj` paths only (tier 3) |
| `Package.swift` | SwiftURL | Exact pins; `Package.resolved` later (tier 4) |

Delivery order and OSV ecosystem strings: [multi-ecosystem-manifest-extraction.md](features/multi-ecosystem-manifest-extraction.md).

## Related documentation

| Document | Purpose |
| -------- | ------- |
| [lockfile-aware-dependency-extraction.md](features/implemented/lockfile-aware-dependency-extraction.md) | npm lockfile parsers (shipped) |
| [multi-ecosystem-manifest-extraction.md](features/multi-ecosystem-manifest-extraction.md) | Non-npm parsers (proposed) |
| [vulnerable-dependency-scanning-osv.md](features/vulnerable-dependency-scanning-osv.md) | OSV provider, cache, CLI, `--deps-scope tree` |

When adding a parser, update this matrix, the relevant feature spec checklist, and [`src/scan/deps/extract.ts`](../src/scan/deps/extract.ts) in the same change.
