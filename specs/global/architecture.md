# Architecture (global)

Cross-cutting package and process contracts for the Codefence implementation. Feature specs MUST NOT contradict this document. Detail for individual surfaces lives in feature specs.

## Package layout

```text
cmd/codefence/          # main: CLI + mcp entry
internal/cli/           # argv parsing, help, command dispatch
internal/config/        # codefence-config.yml + env merge
internal/git/           # staged/unstaged changed files
internal/scan/          # orchestrator, context, aspects registry
internal/scan/code/     # secure-coding + secret wiring
internal/scan/secret/   # YAML rules, entropy, remote cache
internal/scan/deps/     # extractors, OSV client, deps cache
internal/rules/         # built-in secure-coding rules
internal/findings/      # Finding type, severity, confidence
internal/output/        # table + NDJSON writers
internal/hooks/         # pre-commit, background, worker, debounce
internal/install/       # AI assistant file merge
internal/mcp/           # MCP JSON-RPC stdio server + tools
internal/cache/         # .codefence/cache helpers
pkg/codefence/          # optional public library API (stable subset)
rules/secret/           # embedded builtin.yml (go:embed)
templates/ai/           # embedded install templates (go:embed)
```

## Layering (MUST)

1. `cmd/codefence` may import `internal/*` only.
2. `internal/mcp` and `internal/cli` both call `internal/scan` — neither owns scan logic.
3. `internal/scan/deps` owns HTTP to OSV; no network in secret matching or secure-coding rules.
4. Embed assets with `go:embed`; do not read from npm package paths.
5. Prefer stdlib over large frameworks. YAML: one small dependency justified in [nfr.md](nfr.md).
6. No CGO in default release builds (`CGO_ENABLED=0`).

## Aspect model

| Aspect ID | Role |
| --------- | ---- |
| `code` | Secure-coding line rules + secret engine |
| `deps` | Manifest extraction + OSV vulnerability query |

Default aspects: `[code]`. Auto-add `deps` rules are specified in feature `005-scan-orchestrator`.

## Process models

| Mode | Lifetime | Use |
| ---- | -------- | --- |
| CLI one-shot | Short | Hooks, CI, scripts |
| MCP stdio | Long-lived | AI agents |

Both MUST share identical scan semantics and config precedence.

## Exit and error policy

| Situation | CLI exit | MCP |
| --------- | -------- | --- |
| Findings in a run aspect | `1` | Structured findings + failure flags |
| Config / flag error | `2` (usage / config errors) | `isError: true` |
| Provider network failure | Non-zero; fail deps aspect | Tool error, retryable when appropriate |
| Help / success no findings | `0` | `ok: true` |

## Security boundaries

1. Never exfiltrate file contents beyond specified finding evidence.
2. Remote secret-rule downloads require checksum verification.
3. OSV queries send package coordinates only.
4. No background network listener in v1 (stdio MCP only unless a later spec enables HTTP).

## References

- Features: `001-cli-and-commands`, `005-scan-orchestrator`, `012-mcp-server`
