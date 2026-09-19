---
title: "CLI and Commands"
id: 1
slug: "cli-and-commands"
status: specified
authors: ["@kadraman"]
created: 2026-09-19
updated: 2026-09-19
issue: "https://github.com/kadraman/codefence/issues/1"
area: cli
related:
  - 002-config-and-env
  - 012-mcp-server
  - global/architecture
---

# Feature Specification: CLI and Commands

## Summary

Provide a `codefence` CLI with stable commands and flags, plus an `mcp` command for the agent server. Parsing may use a minimal hand-rolled argv parser (preferred for size) or a small stdlib-friendly library — not a heavy CLI framework.

## Problem

Agents, hooks, and docs document commands (`scan`, `pre-commit`, `background-scan`, `scan-worker`, `install`, `install-hooks`). The binary must accept the same invocations so templates and muscle memory transfer.

## User scenarios

### User Story 1 — Run a scan with parity flags (Priority: P1)

**Why this priority**: Primary user and agent entry point; all other surfaces depend on correct dispatch and flag parsing.

**Independent test**: Invoke `codefence scan --help` and `codefence scan --staged --only deps`; assert exit 0 for help and successful parse of staged/only flags.

**Acceptance scenarios**:

1. **Given** the binary is installed, **When** the user runs `codefence scan --staged`, **Then** the CLI dispatches the scan command with staged mode enabled.
2. **Given** valid scan flags, **When** the user passes `--only code,deps` or `--skip deps`, **Then** aspect filtering applies the documented `--only` / `--skip` semantics.
3. **Given** duration-valued flags (e.g. `--deps-cache-ttl 24h`), **When** parsed, **Then** forms like `24h`, `30m`, `15s` are accepted.

### User Story 2 — Discover help and recover from usage errors (Priority: P1)

**Why this priority**: Agents and humans need stable help and predictable exit codes for bad argv.

**Independent test**: `codefence scan --help` exits 0; unknown flag or unknown command exits 2 with usage on stderr.

**Acceptance scenarios**:

1. **Given** root or any subcommand, **When** the user passes `-h` / `--help`, **Then** help is printed and the process exits 0.
2. **Given** an unknown command or unknown flag, **When** the CLI parses argv, **Then** usage is printed and the process exits **2** (deliberate v1 policy; see `global/compatibility.md`).
3. **Given** scan help, **When** printed, **Then** it lists aspects, ignored path prefixes note, and the env var mirror list.

### User Story 3 — Register MCP and utility commands (Priority: P1)

**Why this priority**: MCP is the agent server entry; version and removed-command redirect preserve operator expectations.

**Independent test**: `codefence mcp --help`, `codefence version`, and `codefence check-deps` each dispatch without crashing; unsupported mcp transport rejected with a clear error.

**Acceptance scenarios**:

1. **Given** the binary, **When** the user runs `codefence mcp`, **Then** the MCP stdio server command is registered and accepts `--cwd`, `--transport stdio`, and `--log-level`.
2. **Given** `--transport` other than `stdio`, **When** parsed, **Then** the CLI rejects it with a clear error (v1 stdio only).
3. **Given** `codefence version`, **When** run, **Then** version/commit is printed.
4. **Given** `codefence check-deps`, **When** run, **Then** the command prints a redirect to `scan` and does not run a separate deps-only path.

### Edge cases

- `--flag=value` form and multi `--paths` must parse as documented for scan options.
- Unknown command → usage + non-zero exit (exit 2).
- Global `-h` / `--help` on root and every subcommand.

## Requirements

### Functional requirements

- **FR-001**: System MUST register commands: `scan`, `pre-commit`, `background-scan`, `scan-worker`, `install`, `install-hooks`, `mcp`, `version`, and `check-deps` (redirect only).
- **FR-002**: `scan` MUST support flags: `--staged`, `--paths <files...>`, `--only <aspects>`, `--skip <aspects>`, `--format <table|json>`, `--quiet`, `--verbose`, `--deps-provider <osv|custom>`, `--deps-provider-url <url>`, `--deps-refresh`, `--deps-cache-ttl <dur>`, `--deps-timeout <dur>`, `--deps-http2 <auto|on|off>`, `--deps-scope <changed|tree>`, `--secret-rules <path...>`, `--secret-default-rules <on|off>`, `--secret-default-rules-version <v>`, `--secret-rules-update-url <url>`, `--secret-rules-refresh`, `--secret-rules-cache-ttl <dur>`, `--secret-entropy-threshold <n>`, `--secret-min-length <n>`, `--secret-min-confidence <low|medium|high>`.
- **FR-003**: `--only` / `--skip` aspects MUST be comma-separated from the set `code`, `deps`.
- **FR-004**: Duration flags MUST accept forms like `24h`, `30m`, `15s`.
- **FR-005**: `pre-commit` MUST be equivalent to `scan --staged` for Git hook use.
- **FR-006**: `mcp` MUST accept `--cwd <path>` (default process cwd), `--transport stdio` (reject others), `--log-level <error|warn|info|debug>` (stderr only).
- **FR-007**: Precedence MUST be **CLI flags > `CODEFENCE_*` env > `codefence-config.yml` > builtins** (as documented in the README / example config; merge details in `002-config-and-env`).
- **FR-008**: Root and subcommands MUST support `-h` / `--help`.
- **FR-009**: Unknown command or usage/flag error MUST exit **2** with usage.
- **FR-010**: `check-deps` MUST print a redirect to `scan` (removed-command redirect).
- **FR-011**: `version` MUST print version/commit.
- **FR-012**: `install` MUST support `--dry-run` for merging AI guardrail files; `install-hooks` MUST support `--dry-run` for Git + IDE hooks.
- **FR-013**: Help for `scan` MUST list aspects, ignored path prefixes note, and env var mirror list.

### Non-goals

- Implementing scan engines, MCP protocol handlers, install/hook bodies beyond command registration and flag wiring (those live in features 005–012).
- Heavy CLI frameworks.

## Success criteria

- **SC-001**: All documented commands are accepted; `mcp` and `version` are available.
- **SC-002**: Flag/env/config precedence matches the documented order.
- **SC-003**: Help text is complete and golden-stable (version line may drift).
- **SC-004**: Parse tests cover happy paths and usage errors (exit 2).
- **SC-005**: Example invocations work: `scan --staged`, `scan --only deps`, `mcp`, `install --dry-run`, `install-hooks`.

## Assumptions

- Command bodies call into library packages specified elsewhere; this feature owns argv parsing, dispatch, and help.
- Config merge behavior is specified in `002-config-and-env`.

## Open questions

- None; issue link remains TBD.

## References

- Related: [`002-config-and-env`](../002-config-and-env/), [`012-mcp-server`](../012-mcp-server/), [`global/architecture.md`](../../global/architecture.md)
