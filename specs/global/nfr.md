# NFR: Binary Size and Startup (global)

Hard and soft budgets for Codefence. Feature work MUST NOT regress hard budgets without an accepted exception.

## Hard budgets (v1 release gate)

Measured on CI `ubuntu-latest`, linux amd64, release binary:

```bash
CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o codefence ./cmd/codefence
```

| Budget | Metric | Limit |
| ------ | ------ | ----- |
| B1 | Stripped binary size | ≤ **12 MiB** |
| B2 | `codefence version` wall time (cold process, warm disk) | ≤ **30 ms** p95 over 50 runs |
| B3 | `codefence --help` wall time | ≤ **50 ms** p95 |
| B4 | `codefence scan --staged` empty git repo (no network) | ≤ **150 ms** p95 |
| B5 | RSS after `version` exits (max RSS) | ≤ **40 MiB** |
| B6 | MCP: process start through `initialize` **and** `tools/list` | ≤ **80 ms** p95 |
| B7 | Direct `require` in go.mod (non-test) | ≤ **8** packages |

UPX / similar compression is **disallowed** by default.

## Soft budgets (warn)

| Metric | Warn |
| ------ | ---- |
| Binary size | > 10 MiB |
| Empty staged scan | > 100 ms p95 |
| Direct dependencies | > 5 |

## Build and distribution (MUST)

1. Default release: `CGO_ENABLED=0`, `-trimpath`, `-ldflags="-s -w"`.
2. Publish `codefence_${version}_${os}_${arch}` (+ `.sha256`) for linux/darwin/windows × amd64/arm64.
3. Embed only required assets (builtin secret rules, AI templates). Do not embed example fixtures in the release binary.
4. Version via `ldflags` `-X` without large version libraries.

## Dependency policy

**Allowed with justification:** small YAML (`gopkg.in/yaml.v3` or equivalent); MCP via thin hand-rolled JSON-RPC preferred if an SDK exceeds ~2 MiB binary impact.

**Disallowed** unless an NFR exception spec is accepted: full OpenTelemetry stacks, ORMs, gRPC/K8s clients, embedded browsers/WASM, REPL/TUI frameworks in the default binary.

## Startup design (MUST)

1. Lazy init: do not load secret rules, full config trees, or HTTP clients until needed.
2. `version` / `--help` / MCP `initialize` + `tools/list` avoid git and filesystem walks beyond cwd resolution.
3. Compile builtin regexes once per process (critical for MCP); CLI may compile on demand.
4. Enforce lockfile read cap **10 MiB**.
5. Reuse OSV HTTP client per process in MCP mode.
6. Do not start background goroutine pools until scan starts.

## Bench harness

Ship `scripts/bench-startup.sh` (or `internal/bench`) that builds the release binary, records size, times `version` / `--help` / empty `scan --staged` / MCP `initialize`→`tools/list`, writes JSON to CI artifacts, and fails on hard-budget breach.

## References

- Testing gates: [testing.md](testing.md)
