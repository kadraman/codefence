# Dependency scanning support matrix

Codefence dependency scanning has two layers:

1. **Trigger** — Changing the file (or including it via `--deps-scope tree`) can enable the `deps` aspect.
2. **Extraction** — The scanner produces `(ecosystem, name, version)` coordinates for the OSV batch API.

Engineering source of truth:

- Extractors / matrix: [`specs/features/008-deps-extractors/`](../specs/features/008-deps-extractors/)
- OSV provider, cache, CLI: [`specs/features/009-deps-scanning/`](../specs/features/009-deps-scanning/)
- Implementation path: `internal/scan/deps/extract/`

## MVP (required for first release)

| Ecosystem | OSV ecosystem | Extract | Notes |
| --------- | ------------- | ------- | ----- |
| JavaScript / TypeScript (Node) | `npm` | `package.json` (exact pins), `package-lock.json` v2/v3, Classic `yarn.lock`, `pnpm-lock.yaml` | Lock prefer: pnpm → npm → yarn; Yarn Berry warn/empty |
| Go | `Go` | `go.mod` | `go.sum` is **trigger-only** (no version extraction) |

Shared rules:

- Skip version **ranges** unless a lockfile **in scope** supplies resolved versions.
- If only a ranged manifest is in scope but a lockfile exists on disk, emit a **warning**.
- Lockfile reads are capped at **10 MiB** (warning on cap).

Until features `008` and `009` are complete, treat MVP rows as **specified**, not shipped.

## Scope: changed vs tree

| Mode | Flag / config | Behavior |
| ---- | ------------- | -------- |
| Changed (default) | `--deps-scope changed` / `deps.scope: changed` | Manifests in the git change set or explicit `--paths` |
| Tree | `--deps-scope tree` / `deps.scope: tree` | Discover MVP manifests under the repo (or under each `--paths` root); common vendor dirs skipped |

Provider defaults (`osv`, cache under `.codefence/cache/deps/`, timeouts, `--deps-refresh`, `--deps-http2`): see feature `009` and [README.md](../README.md).

## JavaScript / TypeScript (`npm`)

| Manifest | Role | Notes |
| -------- | ---- | ----- |
| `package.json` | Extract | Exact pins only; ranges need a sibling lockfile in scope |
| `package-lock.json` | Extract | v2/v3; legacy v1 unsupported |
| `yarn.lock` | Extract | Classic only; Yarn Berry (`__metadata`) → warn, no coordinates |
| `pnpm-lock.yaml` | Extract | All importers/packages when lockfile is in scope |

Same-directory lock preference: `pnpm-lock.yaml` → `package-lock.json` → `yarn.lock`.

## Go (`Go`)

| Manifest | Role | Notes |
| -------- | ---- | ----- |
| `go.mod` | Extract | `require` lines with semver (`v` prefix stripped for OSV); pseudo-versions skipped |
| `go.sum` | Trigger only | Checksum companion; does not produce coordinates |

## Empty coordinates and trigger-only

When manifests are in scope but nothing extractable is found:

```text
[deps] SKIPPED — No exact-version dependencies extracted from changed manifests.
```

When a trigger-only file is present without extractable coordinates (e.g. `go.sum`):

```text
[deps] SKIPPED — No dependency extractor for: go.sum. See docs/dependency-support.md.
```

## Post-MVP roadmap

Not required for MVP. Each wave ships as its own feature slice (see `008` spec):

| Wave | Ecosystem | OSV ecosystem |
| ---- | --------- | ------------- |
| 2 | Python | `PyPI` |
| 3 | Rust | `crates.io` |
| 4 | Ruby, PHP | `RubyGems`, `Packagist` |
| 5 | JVM, .NET | `Maven`, `NuGet` |
| 6 | Swift | `SwiftURL` |

Manifest details for roadmap ecosystems live in [`specs/features/008-deps-extractors/spec.md`](../specs/features/008-deps-extractors/spec.md) (roadmap table). Do not invent extractors ahead of an accepted feature.

## Related

| Document | Purpose |
| -------- | ------- |
| [roadmap.md](roadmap.md) | User-facing MVP + later overview |
| [`008-deps-extractors`](../specs/features/008-deps-extractors/) | MVP matrix, roadmap, size cap |
| [`009-deps-scanning`](../specs/features/009-deps-scanning/) | OSV client, cache, findings |
| [README.md](../README.md) | CLI flags and `--deps-scope tree` |

When changing MVP or roadmap scope, update this page, [roadmap.md](roadmap.md), and feature `008` in the same change.
