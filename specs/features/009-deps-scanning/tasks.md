# Tasks: Dependency Vulnerability Scanning (OSV)

**Input**: [spec.md](spec.md), [plan.md](plan.md)

**Format**: `- [ ] Tnnn [P?] [USn?] Description` with **exact repo paths**.

- **[P]**: can run in parallel (different files, no shared-write dependency)
- **[USn]**: maps to a user story in spec.md

## Phase 0: Foundation (blocks stories)

- [ ] T001 Add deps package skeleton under `internal/scan/deps/` (client, cache, map types)
- [ ] T002 [P] Wire deps aspect registration from `internal/scan/` to call deps runner when orchestrator includes `deps`
- [ ] T003 [P] Ensure config/flag plumbing for deps fields in `internal/config/` and `internal/cli/` matches `002` / `001` (`provider`, `provider_url`, `refresh`, `cache_ttl`, `timeout`, `http2`, `scope`)

**Checkpoint**: foundation complete before user-story work.

## Phase 1: User Story 1 — OSV batch query and findings (P1)

- [ ] T010 [US1] Implement OSV `querybatch` HTTP client in `internal/scan/deps/osv_client.go` (batch size 100, concurrency 8, retries `[0, 300]ms`, timeout default 15s)
- [ ] T011 [US1] Map advisories to `vulnerable-dependency` findings in `internal/scan/deps/findings.go` using `internal/findings/`
- [ ] T012 [US1] Fail deps aspect when any vuln finding exists; integrate exit/status in `internal/scan/`
- [ ] T013 [US1] Unit + mock HTTP tests in `internal/scan/deps/osv_client_test.go` and `internal/scan/deps/findings_test.go`; fixtures under `testdata/deps/osv/`

**Checkpoint**: story independently testable against mock OSV.

## Phase 2: User Story 2 — Disk cache and refresh (P1)

- [ ] T020 [US2] Disk cache under `.codefence/cache/deps/` in `internal/scan/deps/cache.go` (and helpers in `internal/cache/` if shared)
- [ ] T021 [US2] Honor `--deps-refresh` / TTL default 24h; tests in `internal/scan/deps/cache_test.go` proving cache hit skips network

**Checkpoint**: cache hit avoids network.

## Phase 3: User Story 3 — HTTP/2 and provider surface (P2)

- [ ] T030 [P] [US3] HTTP/2 `auto|on|off` transport selection in `internal/scan/deps/http_transport.go` + tests
- [ ] T031 [P] [US3] Provider stub for `custom` (clear not-supported) and OSV-compatible `--deps-provider-url` with `osv` in `internal/scan/deps/provider.go`
- [ ] T032 [US3] Document HTTP/2 `auto|on|off` mapping in `docs/` (or deps section of the README) without inventing new flags

## Phase 4: User Story 4 — Network policy (P1)

- [ ] T040 [US4] Zero-coordinate short-circuit + unpinned-manifest warning in `internal/scan/deps/runner.go`
- [ ] T041 [US4] Provider failure → actionable deps aspect failure (no silent pass); tests in `internal/scan/deps/runner_test.go`
- [ ] T042 [US4] Export client/cache API for MCP `deps_lookup` consumption from `internal/mcp/` (feature `012`)

## Polish

- [ ] T900 Update user-facing docs under `docs/` for OSV/deps behavior if required
- [ ] T901 Move this folder to `specs/complete/009-deps-scanning/` and update `specs/STATUS.md` when shipped
