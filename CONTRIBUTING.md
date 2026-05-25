# Contributing to codefence

## Development setup

### Prerequisites

- Node.js 18 or newer
- Git

### Clone and install

```bash
git clone https://github.com/kadraman/codefence.git
cd codefence
npm install
```

`npm install` runs `prepare`, which compiles TypeScript to `dist/`.

### Day-to-day commands

| Command | Purpose |
| ------- | ------- |
| `npm run build` | Compile `src/` → `dist/` |
| `npm test` | Build and run unit tests |
| `npm run lint` | Typecheck without emitting files |
| `npm run codefence` | Build, then `codefence scan --staged` (this repo) |
| `npm run install:hooks` | Install Git pre-commit + IDE hook configs in this repo |
| `npm run install:ai` | Merge AI assistant instruction templates in this repo |

During development you can also run `node dist/src/cli.js scan --staged` before linking the `codefence` binary.

### Project layout

```text
src/              TypeScript source
  scan/           Unified scan orchestrator
    aspects/      secrets and deps (security scanning aspects)
  rules/          Rule implementations (secrets and dependency vulnerability checks)
dist/             Compiled output (gitignored; included in npm tarball)
tests/            Node test runner tests
examples/         Sample hooks and vulnerable fixtures for consumer repos
templates/ai/     AI assistant instruction templates
.cursor/          Installed Cursor rule (from templates)
.claude/          Claude Code instructions template
.github/          GitHub Copilot instructions template
hooks/            Git pre-commit + IDE background-scan scripts
.codefence/       Local cache and debounce state (gitignored)
```

### Adding a scan aspect

1. Add an id to `ASPECT_IDS` in `src/scan/types.ts`.
2. Implement `ScanAspect` in `src/scan/aspects/`.
3. Register it in `ASPECT_REGISTRY` in `src/scan/runner.ts`.
4. Document CLI/env options in `printScanHelp()` and README.

### Testing changes locally in another project

**Option 1: `npm link`**

```bash
# In this repository
npm link

# In your application repo
npm link codefence
codefence scan --staged
```

**Option 2: install from a local path**

```json
"devDependencies": {
  "codefence": "file:../codefence"
}
```

**Option 3: `npx` from the repo root (while developing)**

```bash
cd /path/to/your-app
npx --package=file:/path/to/codefence codefence scan --staged
```

### Pull requests

1. Branch from `main`.
2. Run `npm test` and `npm run codefence` before opening the PR.
3. Update README / CONTRIBUTING if behavior or CLI flags change.
4. Keep scans local/embedded; external security CLIs belong in separate CI pipelines, not in this package.

---

## Release and publish to npm

| | |
| --- | --- |
| **npm package** | `codefence` |
| **CLI binary** | `codefence` |

### Maintainer prerequisites

- npm account with publish access to the `codefence` package
- Two-factor authentication enabled on npm
- Logged in locally: `npm login` (or `NPM_TOKEN` in CI with access to the scope)

### Versioning

Follow [Semantic Versioning](https://semver.org/):

- **PATCH** — bug fixes, rule tweaks, docs
- **MINOR** — new rules or backward-compatible CLI options
- **MAJOR** — breaking CLI or config changes

Bump `version` in `package.json` before each release.

### Pre-release checklist

```bash
npm ci
npm test
npm run lint
npm pack --dry-run
```

Confirm the tarball contains `dist/`, `hooks/`, `templates/`, `README.md`, and `LICENSE`. `prepack` runs `npm run build` so `dist/` is current.

Optional smoke test:

```bash
npm pack
mkdir /tmp/codefence-test && cd /tmp/codefence-test
npm init -y
npm install /path/to/codefence/codefence-1.0.0.tgz
npx codefence scan --help
```

Note: `npm pack` produces a tarball named like `codefence-1.0.0.tgz`.

### Publish to npmjs.com

`publishConfig.access` is set to `public` in `package.json`.

**First publish**

```bash
npm publish --access public
```

**Subsequent releases**

```bash
# After bumping version in package.json
git add package.json package-lock.json
git commit -m "chore: release v1.1.0"
git tag v1.1.0
git push origin main --tags
npm publish
```

### CI publish (recommended)

Store an npm automation token as `NPM_TOKEN` and publish on tag:

```yaml
# Example — add .github/workflows/release.yml when ready
on:
  push:
    tags:
      - "v*"
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          registry-url: "https://registry.npmjs.org"
      - run: npm ci
      - run: npm test
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### After publish

- Verify at https://www.npmjs.com/package/codefence
- Consumers pin: `"codefence": "^1.1.0"`
- GitHub release notes for the tag

### Consumer install

```bash
npm install -D codefence
codefence scan --staged

npm install -g codefence
npx --package=codefence codefence scan --staged
```

GitHub installs (`github:kadraman/codefence`) remain supported for forks and pre-release testing.
