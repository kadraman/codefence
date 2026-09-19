---
title: "Config and Environment"
id: 2
slug: "config-and-env"
status: specified
authors: ["@kadraman"]
created: 2026-09-19
updated: 2026-09-19
issue: "https://github.com/kadraman/codefence/issues/2"
area: config
related:
  - 001-cli-and-commands
  - global/architecture
---

# Feature Specification: Config and Environment

## Summary

Load repository defaults from `codefence-config.yml` (version 1 schema), merge with `CODEFENCE_*` environment variables and CLI flags. Schema matches `examples/codefence-config.yml.example`.

## Problem

Teams need repo-level defaults without wrapping every CLI flag. Agents also set env vars in CI. Precedence bugs cause “works on my machine” scan drift.

## User scenarios

### User Story 1 — Load repo defaults from cwd (Priority: P1)

**Why this priority**: Stable defaults are the foundation for CLI and MCP scan options.

**Independent test**: Place a valid `codefence-config.yml` in the process cwd; load defaults without error and assert schema fields.

**Acceptance scenarios**:

1. **Given** `codefence-config.yml` with `version: 1` in the cwd, **When** config is loaded, **Then** scan/deps/secret defaults populate the merge result.
2. **Given** v1 decision, **When** loading, **Then** the file is read from **cwd only** (no upward walk).
3. **Given** invalid YAML or unsupported version, **When** loaded, **Then** a clear error is returned and CLI exits **2**.

### User Story 2 — Merge env and flags with correct precedence (Priority: P1)

**Why this priority**: Precedence bugs are the stated product pain.

**Independent test**: Merge matrix — flag beats env beats file beats builtins.

**Acceptance scenarios**:

1. **Given** file, env, and flag all set for the same key, **When** merged, **Then** precedence is **CLI flags > `CODEFENCE_*` env > `codefence-config.yml` > builtins**.
2. **Given** boolean env vars, **When** parsed, **Then** truthy values are `1|true|on|yes` (case-insensitive).
3. **Given** `examples/codefence-config.yml.example`, **When** loaded, **Then** it succeeds without error.

### User Story 3 — Local cache paths under `.codefence/` (Priority: P2)

**Why this priority**: Scanners and install need known local state dirs; not part of YAML schema.

**Independent test**: Document/ensure path constants match the table; install ensures `.codefence/` is gitignored (install feature may own the gitignore write).

**Acceptance scenarios**:

1. **Given** a scan that caches, **When** writing local state, **Then** paths under `.codefence/cache/code/`, `.codefence/cache/deps/`, `.codefence/cache/secret-rules/`, and `.codefence/debounce.json` are used as specified.
2. **Given** `install`, **When** run, **Then** `.codefence/` is ensured gitignored (coordinate with install feature).

### Edge cases

- Missing config file → builtins (and env/flags) only; not an error.
- Nullables in schema (`provider_url`, `default_rules_version`, `rules_update_url`) remain optional.

## Requirements

### Functional requirements

- **FR-001**: System MUST load `codefence-config.yml` from process **cwd only** (v1; no upward walk).
- **FR-002**: Schema MUST be `version: 1` with sections `scan`, `paths`, `deps`, `secret` matching the example file.
- **FR-003**: `scan` keys: `aspects` (default `[code]`), `format` (`table` \| `json`), `quiet`, `verbose`.
- **FR-004**: `paths.git_ignored_prefixes` MUST be a string list (default `[]`).
- **FR-005**: `deps` keys: `provider` (`osv`), `provider_url` (nullable), `refresh`, `cache_ttl` (default `24h`), `timeout` (default `15s`), `http2` (`auto`), `scope` (`changed`).
- **FR-006**: `secret` keys: `rules`, `default_rules` (`on`), `default_rules_version` (nullable), `rules_update_url` (nullable), `rules_refresh`, `rules_cache_ttl` (default `24h`), `entropy_threshold` (default `4.2`), `min_length` (default `12`), `min_confidence` (default `low`).
- **FR-007**: Precedence MUST be CLI flags > env > file > builtins.
- **FR-008**: Env mirrors MUST include: `CODEFENCE_ASPECTS`, `CODEFENCE_ONLY`, `CODEFENCE_SKIP`, `CODEFENCE_FORMAT`, `CODEFENCE_QUIET`, `CODEFENCE_VERBOSE`, `CODEFENCE_GIT_IGNORED_PREFIXES`, `CODEFENCE_DEPS_*`, `CODEFENCE_SECRET_*` (stable documented names).
- **FR-009**: Boolean env parsing MUST treat `1|true|on|yes` as truthy (case-insensitive).
- **FR-010**: Local state dirs (not schema): `.codefence/cache/code/`, `.codefence/cache/deps/`, `.codefence/cache/secret-rules/`, `.codefence/debounce.json`.
- **FR-011**: Invalid YAML / schema MUST produce a clear error; CLI usage path exits 2.

### Non-goals

- Upward directory walk for config in v1.
- Inventing config keys beyond the example schema.

## Success criteria

- **SC-001**: Schema matches `examples/codefence-config.yml.example`.
- **SC-002**: Env mirror names are complete as listed in FR-008.
- **SC-003**: Merge matrix tests prove flag > env > file > builtins.
- **SC-004**: Documented in the README when shipped.

## Assumptions

- CLI flag application is owned by `001-cli-and-commands`; this feature owns file + env load and merge helpers.
- Cache writers live in scan/deps/secret packages; this feature defines path contracts.

## Open questions

- None; issue link remains TBD.

## References

- Example: `examples/codefence-config.yml.example`
- Related: [`001-cli-and-commands`](../../complete/001-cli-and-commands/)
