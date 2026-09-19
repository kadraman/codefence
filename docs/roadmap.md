# Roadmap

What Codefence aims to ship, in plain language. Engineering detail lives under [`specs/`](../specs/); this page is for users.

**Status today:** features below are **specified** for the first release. CLI command parsing and help (**001**) are shipped; engines and integrations are not yet ([`specs/STATUS.md`](../specs/STATUS.md)). Treat “MVP” as the planned first cut, not a promise of dates.

## First release (MVP)

### Scan and findings

| Capability | What you get |
| ---------- | ------------ |
| CLI | `codefence scan`, help, exit codes, `version` |
| Config | `codefence-config.yml` + `CODEFENCE_*` env (flags win) |
| Secrets | Semgrep-style YAML rules, builtin pack, entropy heuristics |
| Secure-coding | Built-in line rules (e.g. eval / insecure HTTP) |
| Dependencies | OSV lookups for **JavaScript/TypeScript (npm)** and **Go** |
| Output | Table and NDJSON (`--format`) |

### Integrations

| Capability | What you get |
| ---------- | ------------ |
| Git hooks | Pre-commit + IDE background scan (`install-hooks`) |
| AI assistants | Non-destructive `codefence install` for Cursor, Claude, Copilot |
| MCP | `codefence mcp` tools for agents (`scan`, `get_findings`, …) |

### Dependency ecosystems (MVP)

| Ecosystem | Status |
| --------- | ------ |
| JavaScript / TypeScript (npm lockfiles) | MVP |
| Go (`go.mod`) | MVP |

Details and manifests: [dependency-support.md](dependency-support.md).

## Later (post-MVP)

### More dependency ecosystems

Suggested order (may change):

| Wave | Ecosystems |
| ---- | ---------- |
| 2 | Python |
| 3 | Rust |
| 4 | Ruby, PHP |
| 5 | JVM (Maven/Gradle), .NET (NuGet) |
| 6 | Swift |

Each wave needs its own accepted feature before implementation. Manifest lists: [dependency-support.md](dependency-support.md) and [`008-deps-extractors`](../specs/features/008-deps-extractors/).

### Explicitly deferred

- Maven/Gradle BOM / property resolution (when JVM lands)
- Extracting versions from `go.sum` (trigger-only for now)
- Offline vulnerability database (OSV stays network-based)

## How this maps to engineering work

| User-facing area | Spec folders |
| ---------------- | ------------ |
| CLI / config / findings / output | `001`–`004` |
| Scan orchestration | `005` |
| Secure-coding + secrets | `006`, `007` |
| Deps extract + OSV | `008`, `009` |
| Hooks / AI install / MCP | `010`–`012` |

Index: [`specs/STATUS.md`](../specs/STATUS.md).

## Related docs

| Doc | Purpose |
| --- | ------- |
| [README.md](../README.md) | Install and CLI |
| [dependency-support.md](dependency-support.md) | Deps matrix detail |
| [ai-assistants.md](ai-assistants.md) | Assistant setup |
| [hooks.md](hooks.md) | Pre-commit and background scan |
