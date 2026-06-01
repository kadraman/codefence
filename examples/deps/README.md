# Dependency-scanning fixtures

Path: `examples/deps/`

These manifests pin **exact versions** (or lockfile-resolved versions) of packages with known [OSV](https://osv.dev/) advisories and CVEs. Each npm example includes a sibling `package-lock.json`; Python Pipenv, Poetry, and uv examples include `Pipfile.lock`, `poetry.lock`, or `uv.lock` so scans resolve ranged manifest entries the same way real projects do. The `requirements.txt` fixture uses direct `==` pins only. These are fake projects for local testing only — do not install or publish them.

| Fixture | Section | Package | Version | Example CVE | Fixed |
| ------- | ------- | ------- | ------- | ----------- | ----- |
| `npm/runtime-app/package.json` / `package-lock.json` | `dependencies` | `lodash` | `4.17.20` | `CVE-2020-28500` | `>= 4.17.21` |
| `npm/runtime-app/package.json` / `package-lock.json` | `dependencies` | `minimist` | `1.2.5` | `CVE-2021-44906` | `>= 1.2.6` |
| `npm/dev-tooling/package.json` / `package-lock.json` | `devDependencies` | `ws` | `7.3.0` | `CVE-2024-37890` | `>= 5.2.4` |
| `npm/dev-tooling/package.json` / `package-lock.json` | `devDependencies` | `jsonwebtoken` | `8.5.1` | `CVE-2022-23539` | `>= 9.0.0` |
| `npm/library/package.json` / `package-lock.json` | `optionalDependencies` | `node-fetch` | `2.6.0` | `CVE-2022-0235` | `>= 3.1.1` |
| `python/requirements-app/requirements.txt` / `requirements-dev.txt` | direct requirements | `django` | `2.2.24` | `CVE-2021-45116` | `>= 2.2.25` |
| `python/requirements-app/requirements-dev.txt` | `-r` include | `pytest` | `7.4.0` | (dev include via `-r`) | — |
| `python/pipfile-app/Pipfile` / `Pipfile.lock` | `[packages]` | `jinja2` | `2.11.2` | `CVE-2020-28493` | `>= 2.11.3` |
| `python/pipfile-app/Pipfile.lock` | resolved | `click` | `8.1.7` | (from lock; resolves `>=8.1.0` in Pipfile) | — |
| `python/pyproject-app/pyproject.toml` / `poetry.lock` | `[project.dependencies]` | `urllib3` | `1.26.4` | `CVE-2021-33503` | `>= 1.26.5` |
| `python/pyproject-app/poetry.lock` | resolved | `requests` | `2.31.0` | (from lock; resolves `>=2.31.0` in pyproject.toml) | — |
| `python/uv-app/pyproject.toml` / `uv.lock` | `[project.dependencies]` | `urllib3` | `1.26.4` | `CVE-2021-33503` | `>= 1.26.5` |
| `python/uv-app/uv.lock` | resolved | `requests` | `2.31.0` | (from lock; resolves `>=2.31.0` in pyproject.toml) | — |
| `go/mod-app/go.mod` | `require` (direct) | `golang.org/x/crypto` | `0.16.0` | `CVE-2023-48795` | `>= 0.17.0` |
| `go/mod-app/go.mod` | `require` (direct) | `github.com/go-jose/go-jose/v3` | `3.0.0` | `CVE-2024-28176` | `>= 3.0.3` |
| `go/mod-app/go.mod` | `require` (indirect) | `github.com/google/uuid` | `1.6.0` | (no known advisory) | — |

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
