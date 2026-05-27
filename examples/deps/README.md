# Dependency-scanning fixtures

Path: `examples/deps/`

These manifests pin **exact versions** of packages with known [OSV](https://osv.dev/) advisories and CVEs. Each npm example now also includes a sibling `package-lock.json` so dependency scans can resolve lockfile-backed versions the same way real projects do. They are fake projects for local testing only — do not install or publish them.

| Fixture | Section | Package | Version | Example CVE | Fixed |
| ------- | ------- | ------- | ------- | ----------- | ----- |
| `npm/runtime-app/package.json` / `package-lock.json` | `dependencies` | `lodash` | `4.17.20` | `CVE-2020-28500` | `>= 4.17.21` |
| `npm/runtime-app/package.json` / `package-lock.json` | `dependencies` | `minimist` | `1.2.5` | `CVE-2021-44906` | `>= 1.2.6` |
| `npm/dev-tooling/package.json` / `package-lock.json` | `devDependencies` | `ws` | `7.3.0` | `CVE-2024-37890` | `>= 5.2.4` |
| `npm/dev-tooling/package.json` / `package-lock.json` | `devDependencies` | `jsonwebtoken` | `8.5.1` | `CVE-2022-23539` | `>= 9.0.0` |
| `npm/library/package.json` / `package-lock.json` | `optionalDependencies` | `node-fetch` | `2.6.0` | `CVE-2022-0235` | `>= 3.1.1` |

Run against the full fixture tree:

```bash
npm run build
node dist/src/cli.js scan --only deps --paths examples/deps
```

Discover all manifests under `examples/deps` without listing each path:

```bash
node dist/src/cli.js scan --only deps --deps-scope tree --paths examples/deps
```

Audit every dependency manifest in the repository:

```bash
node dist/src/cli.js scan --only deps --deps-scope tree
```

JSON output for LLM/tooling use:

```bash
node dist/src/cli.js scan --only deps --paths examples/deps --format json --deps-refresh
```

Force a fresh OSV lookup (ignore cache):

```bash
node dist/src/cli.js scan --only deps --paths examples/deps --deps-refresh
```

Note: git-changed scans ignore `examples/` by default. Explicit `--paths` includes these files.

Scans against these fixtures are expected to **exit with code 1** (findings are intentional). Table output aggregates multiple advisories per package version into one row; JSON output lists each advisory separately.

Severity follows OSV/CVSS mapping (`critical` / `high` / `medium` / `low`). For example, `minimist@1.2.5` (CVSS 9.8) is **critical**; `lodash@4.17.20` (CVSS 7.5) is **high**.
