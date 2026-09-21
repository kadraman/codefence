# Roadmap

What Codefence aims to ship, in plain language. Engineering detail lives under [`specs/`](../specs/); this page is for users.

**Status today:** CLI, config, findings, output, scan orchestration, and secure-coding rules (**001–006**) are shipped; remaining engines and integrations (**007–012**) are specified but not yet ([`specs/STATUS.md`](../specs/STATUS.md)). Treat “MVP” as the planned first cut, not a promise of dates.

## First release (MVP)

### Scan and findings

| Capability | What you get |
| ---------- | ------------ |
| CLI | `codefence scan`, help, exit codes, `version` |
| Config | `codefence-config.yml` + `CODEFENCE_*` env (flags win) |
| Secrets | Semgrep-style YAML rules, builtin pack, entropy heuristics |
| Secure-coding | Built-in line rules `no-eval`, `no-shell-true`, `no-insecure-http` |
| Dependencies | OSV lookups for **JavaScript/TypeScript (npm)**, **Go**, and **Python (PyPI)** |
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
| Python (`requirements.txt` / Poetry / uv / Pipfile) | MVP |

Details and manifests: [dependency-support.md](dependency-support.md).

## Later (post-MVP)

### More dependency ecosystems

Suggested order (may change):

| Wave | Ecosystems |
| ---- | ---------- |
| 2 | Rust |
| 3 | Ruby, PHP |
| 4 | JVM (Maven/Gradle), .NET (NuGet) |
| 5 | Swift |

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
