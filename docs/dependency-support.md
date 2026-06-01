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
| Rust | `crates.io` | Yes | Planned | `Cargo.toml` / `Cargo.lock` |
| Ruby | `RubyGems` | Yes | **Shipped** (`Gemfile`, `Gemfile.lock`) | Exact pins in Gemfile; lockfile wins when in scope |
| PHP | `Packagist` | Yes | **Shipped** (`composer.json`) | Exact `require` / `require-dev` versions; `composer.lock` planned |
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

## Other manifests (partial support)

These files are recognized in [`src/manifests.ts`](../src/manifests.ts) and can start a dependency scan. Some have shipped extraction, while others are still trigger-only and may produce:

```text
[deps] SKIPPED — No exact-version dependencies extracted from changed manifests.
```

For manifests with no extractor yet (for example `pom.xml`):

```text
[deps] SKIPPED — No dependency extractor for: pom.xml. See docs/dependency-support.md.
```

| Manifest | Ecosystem | Extraction status |
| -------- | --------- | ----------------- |
| `requirements.txt` | PyPI | ✅ Shipped (`name==version`, recursive `-r` includes) |
| `go.mod` | Go | ✅ Shipped (`require` with semver; pseudo-versions skipped) |
| `Gemfile` | RubyGems | ✅ Shipped (exact version strings; ranged gems skipped) |
| `Gemfile.lock` | RubyGems | ✅ Shipped (resolved `name (version)` specs) |
| `composer.json` | Packagist | ✅ Shipped (exact `require` / `require-dev`; platform packages skipped) |
| `pyproject.toml` | PyPI | ✅ Shipped (`[project]` and `[project.optional-dependencies]` exact `==` pins) |
| `Pipfile` | PyPI | ✅ Shipped (`[packages]` / `[dev-packages]` exact `==` pins and inline table `version`) |
| `poetry.lock` | PyPI | ✅ Shipped (registry packages) |
| `Pipfile.lock` | PyPI | ✅ Shipped (PyPI packages) |
| `uv.lock` | PyPI | ✅ Shipped (`[[package]]` / `[[distribution]]`, registry sources) |
| `Cargo.toml` | crates.io | Planned (exact pins, tier 2) |
| `Cargo.lock` | crates.io | Planned (lockfile parser, tier 2–3) |
| `go.sum` | Go | Trigger only (checksum companion; no version extraction) |
| `pom.xml` | Maven | Planned (explicit `<version>`, tier 3) |
| `build.gradle`, `build.gradle.kts` | Maven | Planned (explicit coordinates, tier 3) |
| `packages.config` | NuGet | Planned (pinned packages, tier 3) |
| `*.csproj` | NuGet | Planned (`PackageReference` with version, tier 3) |
| `*.sln` | — | Planned (discover referenced `.csproj` paths only, tier 3) |
| `Package.swift` | SwiftURL | Planned (exact pins; `Package.resolved` later, tier 4) |

Delivery order and OSV ecosystem strings: [multi-ecosystem-manifest-extraction.md](features/multi-ecosystem-manifest-extraction.md).

## Related documentation

| Document | Purpose |
| -------- | ------- |
| [lockfile-aware-dependency-extraction.md](features/implemented/lockfile-aware-dependency-extraction.md) | npm lockfile parsers (shipped) |
| [multi-ecosystem-manifest-extraction.md](features/multi-ecosystem-manifest-extraction.md) | Non-npm parsers (partial: Python + Go shipped) |
| [vulnerable-dependency-scanning-osv.md](features/vulnerable-dependency-scanning-osv.md) | OSV provider, cache, CLI, `--deps-scope tree` |

When adding a parser, update this matrix, the relevant feature spec checklist, and [`src/scan/deps/extract.ts`](../src/scan/deps/extract.ts) in the same change.
