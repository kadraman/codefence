---
title: "Lockfile-Aware Dependency Extraction"
status: shipped
owners: ["@kadraman"]
created: 2026-05-27
updated: 2026-05-27
issue: "TBD"
scope: "scan|deps|docs"
---

## Summary

Extend the dependency scanning aspect so Codefence resolves **installed** npm package versions from lockfiles (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`), not only exact semver strings written directly in `package.json`. Lockfile parsing should feed the existing OSV batch query path with the same `DependencyCoordinate` model, caching, and finding output. No new scan aspect or provider is required; this improves accuracy and coverage for typical Node.js projects.

## Problem Statement

Today, dependency extraction (`src/scan/deps/extract.ts`) only reads `package.json` and only accepts **exact** versions (for example `4.17.20`). Ranges such as `^4.17.0`, `~1.2.5`, or `*` are skipped. Lockfiles are already recognized as dependency manifests in `src/manifests.ts` and can trigger the `deps` aspect, but `extractDependenciesForManifest` returns no coordinates for them.

As a result:

1. Most real-world `package.json` files produce **zero** queryable dependencies unless versions are pinned literally.
2. When users change only a lockfile (common in PRs), the scanner may run the deps aspect yet report **skipped** — “No exact-version dependencies extracted.”
3. False negatives: vulnerabilities in resolved lockfile versions are never queried even though OSV supports `npm` ecosystem coordinates.

The OSV integration and deps cache are in place; the missing piece is **resolution** from lockfiles into exact `(name, version)` pairs.

## Proposed Solution

### Behavior

When the `deps` aspect runs, for each dependency manifest in scan scope:

1. **`package-lock.json`** — Parse lockfile format v2/v3 (`lockfileVersion` 2 or 3). Emit one coordinate per unique `name@version` from the `packages` (or legacy `dependencies`) entries that represent installed packages (exclude `""` root-only metadata where appropriate). Use `npm` as the OSV ecosystem.
2. **`yarn.lock`** — Parse Yarn Classic lockfile format (v1). Emit coordinates from resolved entries. Yarn Berry (`yarn.lock` v2+ / `__metadata`) is a follow-up unless trivially supported in v1.
3. **`pnpm-lock.yaml`** — Parse `importers` / `packages` (pnpm v5–v9+). Emit coordinates for resolved package versions.
4. **`package.json`** — Keep current behavior for exact versions. When a sibling lockfile for the same package root is **also** in scope, prefer lockfile-resolved versions for that root (see merge rules).
5. **Deduplication** — Reuse the existing dedupe key: `ecosystem:name:version:manifestPath` (manifest path is the file the coordinate was sourced from, typically the lockfile path for lockfile-sourced rows).
6. **Line numbers** — Set `manifestLine` to a best-effort line in the source file (lockfile line containing the package name or version). Use `0` when not found; do not block scanning.
7. **Failures** — Malformed or unsupported lockfiles: log a clear warning via `writeScanLog` / `writeScanStatus`, return no coordinates from that file, continue other manifests. Do not fail the whole scan unless no coordinates remain and policy says otherwise (unchanged: skip with exit 0).

Out of scope for this feature (documented under [Future Enhancements](#future-enhancements)):

- Non-npm lockfiles (`poetry.lock`, `Gemfile.lock`, `go.sum`, etc.) — see [multi-ecosystem-manifest-extraction.md](./multi-ecosystem-manifest-extraction.md)
- Full semver range resolution without a lockfile
- Workspace-aware “only changed packages in lockfile diff” optimization

### Merge And Precedence Rules

For a given package root directory `D` (directory containing `package.json`):

| Files in scope | Extraction source |
| -------------- | ----------------- |
| `D/package-lock.json` | Lockfile only (ignore ranged entries in `D/package.json` for querying) |
| `D/yarn.lock` | Lockfile only |
| `D/pnpm-lock.yaml` | Lockfile only |
| `D/package.json` only | Exact versions from `package.json` (current behavior) |
| `D/package.json` + lockfile | Lockfile wins for `D` |

If multiple lockfiles exist in the same directory (unusual), prefer in order: `pnpm-lock.yaml` → `package-lock.json` → `yarn.lock`, and log a one-line warning that only one lockfile was used.

Monorepos: each manifest path is resolved independently; no cross-package-root merging in v1.

### Provider And Scan Integration

No change to OSV request shape: each `DependencyCoordinate` still maps to OSV `package.name` + `package.version` with ecosystem `npm`. Existing cache keys remain `provider + url + sorted coordinates`; lockfile-derived coordinates simply populate the set.

When lockfile content changes, coordinates may change → cache miss on next scan (expected). `--deps-refresh` behavior unchanged.

### CLI Surface

No new flags required for v1. Behavior improves automatically when lockfiles are in scan scope (git-changed, `--staged`, or `--paths`).

Optional future flag (not in v1): `--deps-source <lockfile|manifest|auto>` — only if teams need to force manifest-only mode.

Unchanged commands:

- `codefence scan`, `pre-commit`, `background-scan`
- `codefence install`, `codefence install-hooks`

Help text / README should note that npm lockfiles are used for version resolution.

### Config And Environment

No new environment variables in v1.

Optional later: `CODEFENCE_DEPS_LOCKFILE_PREFERENCE` if multi-lockfile repos need explicit control.

### Examples

**Before (ranged `package.json`, no lockfile in scope):**

```bash
codefence scan --staged --only deps
# [deps] SKIPPED — No exact-version dependencies extracted from changed manifests.
```

**After (`package-lock.json` changed):**

```bash
codefence scan --staged --only deps
# Resolves lodash@4.17.20 from package-lock.json → OSV query → findings as today
```

**Explicit paths:**

```bash
codefence scan --only deps --paths apps/web/package-lock.json
```

**Full tree (all manifests under repo or `--paths` roots):**

```bash
codefence scan --only deps --deps-scope tree
```

**With existing fixtures** (`examples/deps/` uses exact `package.json` pins today): add sibling fixtures, e.g. `examples/deps/npm/runtime-app/package-lock.json`, with the same pinned versions so tests do not require network changes to expectations.

Example normalized coordinate (internal):

```json
{
  "ecosystem": "npm",
  "name": "lodash",
  "version": "4.17.20",
  "manifestPath": "/repo/apps/web/package-lock.json",
  "manifestLine": 42
}
```

Example table row (unchanged consumer format):

```text
[high] vulnerable-dependency
file: apps/web/package-lock.json
package: lodash
version: 4.17.20
...
```

## Implementation Plan

### Areas Touched

| Area | Purpose |
| ---- | ------- |
| `src/scan/deps/extract.ts` | Dispatch to lockfile parsers; merge rules |
| `src/scan/deps/extract/` (new) | `packageLock.ts`, `yarnLock.ts`, `pnpmLock.ts` parsers |
| `src/scan/aspects/deps.ts` | Optional: pass package root hints; unchanged if extract returns full set |
| `src/manifests.ts` | Already lists lockfile names; verify comments |
| `tests/depsExtraction.test.ts` | Unit tests per format |
| `tests/fixtures/locks/` (new) | Minimal lockfile snippets |
| `examples/deps/` | Add lockfile fixtures mirroring npm examples |
| `README.md` | Note lockfile resolution under deps / severity section |

### Step-by-Step Plan

1. **Refactor extract layout** — Keep `extractPackageJsonDependencies` public for tests; add `extractPackageLockDependencies`, `extractYarnLockDependencies`, `extractPnpmLockDependencies`.
2. **`package-lock.json`** — Support lockfile v2/v3 `packages` map; skip `link:` / `file:` entries without a resolvable version; normalize version strings (strip `npm:` prefix if present).
3. **`yarn.lock`** — Parse Classic blocks (`"name@version":` / version line); handle scoped packages (`"@scope/pkg@1.2.3"`).
4. **`pnpm-lock.yaml`** — Use a small YAML parser already in the dependency tree, or add a minimal dependency if none exists (prefer zero new deps: hand-roll or reuse existing `yaml` if already pulled in for secret rules).
5. **Wire `extractDependenciesForManifest`** — Branch on basename; implement package-root merge when collecting in `deps.ts` `collectDependencies` (detect sibling lockfile next to `package.json`).
6. **Warnings** — Unsupported lockfile version: single-line human message, no stack trace in default output.
7. **Fixtures and tests** — Golden coordinates for each format; regression test that ranged `package.json` + lockfile yields lockfile versions.
8. **Docs** — README + this doc status; cross-link from `docs/features/vulnerable-dependency-scanning-osv.md` future enhancements.

### Backward Compatibility

Fully backward compatible:

- Repos with exact pins in `package.json` only behave as today.
- Opt-in improvement when lockfiles are present or changed.
- OSV API, CLI flags, cache directory layout, and JSON finding schema unchanged.

### Security Considerations

**Benefits**

- Fewer false negatives when versions live only in lockfiles.
- Aligns scan results with what CI/install actually runs.

**Risks**

- Parser bugs could miss packages (false negatives) or duplicate queries (performance only).
- Maliciously large lockfiles could increase memory/time (mitigate with size guard, e.g. skip or warn above N MB).

**Mitigations**

- Unit tests from real minimal lockfile excerpts (not full `node_modules` trees).
- Cap file read size or line count with a clear warning.
- Fuzz-free deterministic parsers; no `eval` / dynamic code.

## Testing Strategy

### Unit Tests

| Test | File |
| ---- | ---- |
| `package-lock.json` v2 and v3 extraction | `tests/depsExtraction.test.ts` or `tests/depsLockfileExtraction.test.ts` |
| `yarn.lock` Classic scoped/unscoped | same |
| `pnpm-lock.yaml` snapshot | same |
| Merge: `package.json` + lockfile in same dir | same |
| Ranged `package.json` without lockfile still empty | same |

Fixtures under `tests/fixtures/locks/`:

- `package-lock-v3-minimal.json`
- `yarn-classic-minimal.lock`
- `pnpm-minimal.yaml`

### Integration Tests

1. `examples/deps` — Add `package-lock.json` beside `runtime-app`; stub OSV in existing deps tests where applicable.
2. `codefence scan --only deps --paths <lockfile>` exits 1 with expected CVE rows when versions match current fixtures.
3. Staged-scan simulation: only lockfile path in file list still produces coordinates.

### Required Validation Commands

```bash
npm test
npm run codefence
```

## Migration Path

1. Ship lockfile parsers in a minor release.
2. Release notes: “Dependency scans now read npm lockfiles; ensure lockfiles are committed and included in git scans.”
3. Teams that relied on exact pins in `package.json` see no change; teams with ranges gain coverage automatically.

## Implementation Checklist

- [ ] Behavior is documented and unambiguous
- [x] `package-lock.json` parser (v2/v3) implemented
- [x] `yarn.lock` Classic parser implemented
- [x] `pnpm-lock.yaml` parser implemented
- [x] Merge / precedence rules when `package.json` and lockfile coexist
- [x] `extractDependenciesForManifest` dispatches all three lockfile types
- [x] Warnings for unsupported or malformed lockfiles
- [x] Unit tests with minimal fixtures
- [x] Example lockfile fixtures under `examples/deps/`
- [ ] `npm test` passes
- [ ] `npm run codefence` passes
- [x] User-facing docs updated (`README.md`, cross-link from OSV feature doc)

## Future Enhancements

1. Yarn Berry (`yarn.lock` with `__metadata`) and Plug'n'Play layouts
2. `npm-shrinkwrap.json` and legacy `package-lock.json` v1
3. Lockfile-only diff: query OSV for packages whose resolved version changed between commits
4. Python (`poetry.lock`, `Pipfile.lock`), Go (`go.sum`), Ruby (`Gemfile.lock`) extraction
5. `--deps-source` to force manifest-only or lockfile-only resolution
6. Optional dev/prod dependency filtering (`--omit dev`)

## Open Questions

1. **Yarn Berry in v1?** — Support Classic only initially, or invest in Berry parser up front?
2. **File size limit** — Default max lockfile size (e.g. 10 MiB) before skip + warn?
3. **Workspace roots** — Should `pnpm-lock.yaml` at repo root scan all importers, or only importers touched in git diff? (v1 proposal: all packages listed under lockfile when file is in scope.)
4. **Optional dependencies** — Include optional deps from lockfile, or match `npm ls --omit=optional`? (v1 proposal: include all resolved entries with a version.)
5. **Peer dependencies** — Include peers resolved in lockfile? (v1 proposal: yes if present as resolved packages.)

## References

1. [Vulnerable Dependency Scanning With OSV](./vulnerable-dependency-scanning-osv.md) — provider, cache, CLI, manifest triggers
2. `src/scan/deps/extract.ts` — current `package.json`-only extraction
3. `src/manifests.ts` — `dependencyManifestNames` including lockfile basenames
4. [OSV npm ecosystem](https://google.github.io/osv.dev/) — `package.ecosystem: "npm"`
5. [package-lock.json format](https://docs.npmjs.com/cli/v10/configuring-npm/package-lock-json)
6. [Yarn Classic lockfile](https://classic.yarnpkg.com/lang/en/docs/yarn-lock/)
7. [pnpm lockfile](https://pnpm.io/git#lockfiles)

## Additional Notes

- This feature deliberately stays in the **extraction** layer; it does not replace manifest change detection already implemented for the `deps` aspect.
- Parser maintenance is the main long-term cost; keep parsers small, test-heavy, and isolated per format.
- After shipping, update the OSV feature doc checklist item “Lockfile-aware resolution for higher precision” to point here and mark done when complete.
