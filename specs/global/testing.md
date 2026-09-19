# Testing and Acceptance (global)

Test pyramid and release gates for the Codefence implementation.

## Test layers

| Layer | Location | Covers |
| ----- | -------- | ------ |
| Unit | `*_test.go` beside packages | parsers, rules, entropy, aspect resolve, config merge |
| Fixture / golden | `testdata/**` | secrets, deps locks, NDJSON goldens |
| CLI integration | `tests/cli` or `cmd/codefence` harness | argv, exit codes, streams |
| MCP integration | `internal/mcp` scripted RPC | initialize, tools/list, tools/call |
| NFR | `scripts/bench-startup.sh` | size + latency budgets ([nfr.md](nfr.md)) |

## Required commands

```bash
go test ./...
go test -race ./...          # CI required on linux
go vet ./...
./scripts/bench-startup.sh   # fails on budget breach
```

## Fixtures

1. Keep representative fixtures under `testdata/` (secrets, deps locks, examples).
2. Maintain `testdata/PARITY.md` listing fixture sources and goldens.
3. When fixtures or expected outputs change, update goldens via an explicit PR — do not silently drift.

## Feature acceptance

A feature may move to `complete` only when:

1. Behavior checklist / tasks are done.
2. Unit + integration tests listed in that feature pass in CI.
3. No NFR hard-budget regression (or exception filed).
4. User docs updated when user-visible.

## v1 product definition of done

1. Features `001`–`012` complete (or explicitly deferred with issue links).
2. Hard budgets B1–B7 green on CI.
3. MCP tools in `012-mcp-server` all tested.
4. MVP ecosystem extractor matrix complete per `008-deps-extractors` (npm + Go).

## References

- Constitution § VII
