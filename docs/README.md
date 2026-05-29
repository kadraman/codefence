# Documentation index

| Document | Audience | Topics |
| -------- | -------- | ------ |
| [AI-ASSISTANTS.md](AI-ASSISTANTS.md) | App teams using Cursor, Claude, Copilot | `codefence install`, `codefence install-hooks`, automatic local scan loop |
| [HOOKS.md](HOOKS.md) | App teams using Git / IDE hooks | Pre-commit, background scanner, cache |
| [dependency-support.md](dependency-support.md) | All users | Package managers: trigger vs extraction, npm lockfiles, planned ecosystems |

## Feature specifications

| Document | Status | Topics |
| -------- | ------ | ------ |
| [vulnerable-dependency-scanning-osv.md](features/vulnerable-dependency-scanning-osv.md) | Partial (see checklist) | OSV provider, deps aspect, cache, HTTP/2, `--deps-scope tree` |
| [multi-ecosystem-manifest-extraction.md](features/multi-ecosystem-manifest-extraction.md) | Proposed | Python, Go, JVM, .NET, Ruby, PHP, Rust, Swift parsers |
| [implemented/lockfile-aware-dependency-extraction.md](features/implemented/lockfile-aware-dependency-extraction.md) | Shipped | npm lockfile parsing, version resolution for OSV |
| [implemented/semgrep-compatible-secret-engine.md](features/implemented/semgrep-compatible-secret-engine.md) | Implemented | YAML secret rules, entropy, remote bundles |

Main package reference: [README.md](../README.md) (install, `codefence scan`, Semgrep-compatible secret rules, publishing).
