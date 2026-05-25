# Codefence

**Codefence** — guardrails for AI-assisted coding.

- **npm:** [`codefence`](https://www.npmjs.com/package/codefence)
- **CLI:** `codefence`

## What this project provides

- `codefence scan` — local secure-coding rules on git-changed or explicit paths (default: staged/unstaged source files)
- Integrations for Cursor, Claude Code, and GitHub Copilot
- Cross-platform Git pre-commit hook and optional IDE background scanning (`codefence install-hooks`)

## Prerequisites

- [Node.js](https://nodejs.org/) 18+

## Install (consumers)

```bash
npm install -D codefence
```

```json
{
  "scripts": {
    "codefence": "codefence scan --staged"
  }
}
```

```bash
npm run codefence
```

Global or one-off:

```bash
npm install -g codefence
codefence scan --staged

npx --package=codefence codefence scan --staged
```

### From GitHub

```json
"devDependencies": {
  "codefence": "github:kadraman/codefence"
}
```

## Setup (this repository)

```bash
npm install
npm run build
npm run codefence
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for development and npm publish.

## Using guardrails in another project

### Recommended: npm package

```json
{
  "devDependencies": {
    "codefence": "^1.0.0"
  },
  "scripts": {
    "codefence": "codefence scan --staged"
  }
}
```

After `npm install`, the `codefence` binary is linked from `node_modules/.bin/`. The CLI uses your application repo as the working directory.

### Non-JavaScript / non-npm projects

You need Node.js and Git; the app repo does not need its own `package.json`.

```bash
npm install -g codefence
codefence scan --staged
```

Or without global install:

```bash
npx --package=codefence codefence scan --staged
```

Pre-commit: `codefence install-hooks`.

### Other install options

| Approach | When to use |
| -------- | ----------- |
| **npm devDependency** | Node apps |
| **Global `codefence`** | Python, Java, Go, etc. |
| **`npx`** | Hooks without global install |
| **`npm link`** | Local development — [CONTRIBUTING.md](CONTRIBUTING.md) |

## The `scan` command

```bash
codefence scan --staged
codefence scan --paths src/app.ts
codefence scan --help
```

| Option | Description |
| ------ | ----------- |
| `--staged` | Scan staged git files instead of unstaged changes |
| `--paths <files…>` | Scan explicit paths (bypasses git-changed discovery) |
| `--only code` | Run only the code aspect (default) |
| `--skip code` | Skip aspects (unusual with a single aspect) |

Git-based scans skip fixture trees such as `examples/`, `tests/sast/`, and `src/rules/sast/` (see `codefence scan --help`). Explicit `--paths` still scans those files.

**Environment:** `CODEFENCE_ASPECTS`, `CODEFENCE_ONLY`, `CODEFENCE_SKIP` (legacy `DSEC_*` names accepted).

## Git pre-commit and background scanning

```bash
codefence install-hooks
```

See **[docs/HOOKS.md](docs/HOOKS.md)** for testing (`codefence pre-commit`, `codefence background-scan`, cache, bypass).

| Command | Purpose |
| ------- | ------- |
| `codefence install-hooks` | Install Node-based `.git/hooks/pre-commit` + IDE `hooks.json` (if missing) |
| `codefence pre-commit` | Run the same check as Git (without committing) |
| `codefence background-scan --file path` | Queue debounced local scan (IDE / manual) |

## AI assistant integrations (Cursor, Claude, Copilot)

In **each application repo**, run:

```bash
codefence install
```

This merges SAST guardrail instructions **without overwriting** your existing `AGENTS.md`, Claude/Copilot files, or other Cursor rules. It adds `.cursor/rules/sast-guardrails.mdc` as a separate rule file and appends `.codefence/` to `.gitignore` when needed.

```bash
codefence install --dry-run   # preview
```

**Setup guide:** [docs/AI-ASSISTANTS.md](docs/AI-ASSISTANTS.md)

## CLI commands (summary)

| Command | Purpose |
| ------- | ------- |
| `codefence scan` | Run local secure-coding rules (see `codefence scan --help`) |
| `codefence pre-commit` | Same checks as the Git pre-commit hook |
| `codefence install-hooks` | Install `.git/hooks/pre-commit` + optional IDE background scan config |
| `codefence install` | Merge AI assistant instructions (non-destructive) |
| `codefence background-scan` | Queue a debounced background scan (IDE / manual) |

Hook details: [docs/HOOKS.md](docs/HOOKS.md).

## Documentation

| Document | Contents |
| -------- | -------- |
| [README.md](README.md) | Install, `codefence scan`, release |
| [docs/AI-ASSISTANTS.md](docs/AI-ASSISTANTS.md) | Cursor, Claude, Copilot, `codefence install` |
| [docs/HOOKS.md](docs/HOOKS.md) | Git pre-commit, background scanner, cache |
| [docs/README.md](docs/README.md) | Documentation index |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development, tests, npm publish |

## Development and release

| Topic | Document |
| ----- | -------- |
| Local setup, `npm link`, PRs | [CONTRIBUTING.md](CONTRIBUTING.md#development-setup) |
| `npm publish`, tags, CI | [CONTRIBUTING.md](CONTRIBUTING.md#release-and-publish-to-npm) |

```bash
npm ci && npm test
npm version patch
git push origin main --tags
npm publish --access public
```

## License

ISC — see [LICENSE](LICENSE).
