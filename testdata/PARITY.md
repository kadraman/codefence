# Fixture parity index

Representative fixtures and goldens under `testdata/`. When any of these files or their expected outcomes change, update this index in the same PR (`specs/global/testing.md`).

These sets are original Codefence fixtures (not imported from another scanner).

## `testdata/cli/` — CLI help goldens (feature `001`)

| Path | Source / role | Contract |
| ---- | ------------- | -------- |
| `help-root.txt` | Golden stdout for `codefence --help` / empty argv | Exact match after version-line normalization (`internal/cli/run_test.go`) |
| `help-scan.txt` | Golden stdout for `codefence scan --help` | Same |
| `help-mcp.txt` | Golden stdout for `codefence mcp --help` | Same |
| `help-version.txt` | Golden stdout for `codefence version --help` | Same |

## `testdata/output/` — NDJSON wire goldens (feature `004`)

| Path | Source / role | Contract |
| ---- | ------------- | -------- |
| `deps-finding.ndjson` | One deps finding mapped to CLI `--format json` wire keys | Keys `filename`, `location`, `package`, `version`, `fixed`, `cve`; `category` is `dependency` (`internal/output/output_test.go`) |

## `testdata/code/` — secure-coding fixtures (feature `006`)

Exercised by `internal/scan/code/runner_test.go` (`ScanFiles`) and `internal/scan/runner_test.go` (`RunScan` on `positive/eval.js` / `negative/safe.js`). Rule IDs and severities: `specs/complete/006-secure-coding-rules/spec.md`.

### Positive (must emit findings)

| Path | Source / role | Contract |
| ---- | ------------- | -------- |
| `positive/eval.js` | Line with `eval(` | `no-eval` (`kind: code`, severity `high`) |
| `positive/new-function.ts` | Line with `new Function(` | `no-eval` |
| `positive/shell.js` | Line with `shell: true` | `no-shell-true` (severity `medium`) |
| `positive/http.py` | `http://example.com` | `no-insecure-http` (severity `medium`) |
| `positive/http-lookalike.js` | `http://localhost.evil.example` and `http://127.0.0.1.attacker.example` | `no-insecure-http` (host-boundary exemption must not apply) |
| `positive/multi.js` | `eval(` and `http://` on one line | Both `no-eval` and `no-insecure-http` |

### Negative (must not emit findings)

| Path | Source / role | Contract |
| ---- | ------------- | -------- |
| `negative/safe.js` | `evaluate(`, `shell: false`, `https://`, `http://localhost:3000`, `http://127.0.0.1/health` | No secure-coding findings |
| `negative/localhost.yaml` | `http://localhost/health` and `http://127.0.0.1:8080` | No `no-insecure-http` (exempt loopback hosts) |

### Ignored (filter; must not be scanned)

| Path | Source / role | Contract |
| ---- | ------------- | -------- |
| `ignored/readme.md` | Markdown containing `eval(` and `http://` | Not scannable (extension not in 006 allowlist) |
| `ignored/node_modules/pkg/index.js` | `eval(` under `node_modules/` | Not scannable (heavy dir) |
