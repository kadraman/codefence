---
title: "AI Assistant Install"
id: 11
slug: "install-ai"
status: specified
authors: ["@kadraman"]
created: 2026-09-19
updated: 2026-09-19
issue: "https://github.com/kadraman/codefence/issues/11"
area: install
---

# Feature Specification: AI Assistant Install

## Summary

Implement `codefence install` to merge non-destructive AI guardrail instructions for Cursor, Claude Code, and GitHub Copilot, and update templates to mention the `codefence` binary and MCP server where appropriate. Marker names stay stable so re-install does not duplicate guardrail blocks.

## Problem

Assistants must automatically run local scans. Overwriting user instructions is unacceptable; marker-based merge is required. Templates must steer agents toward the `codefence` binary and MCP tools.

## User scenarios

### User Story 1 — Marker-based merge for assistant files (Priority: P1)

**Why this priority**: Non-destructive install is the core product promise for multi-assistant repos.

**Independent test**: Existing user content outside markers is preserved; double install is idempotent; `--dry-run` writes nothing.

**Acceptance scenarios**:

1. **Given** `AGENTS.md` is missing, **When** `codefence install` runs, **Then** it is created with a guardrails section between `<!-- codefence-guardrails:start -->` and `<!-- codefence-guardrails:end -->`.
2. **Given** `AGENTS.md` exists, **When** install runs, **Then** only the region between those markers is updated; content outside markers is preserved.
3. **Given** `.claude/CLAUDE.md` is missing or exists, **When** install runs, **Then** the same create / marker-update policy applies.
4. **Given** `.github/copilot-instructions.md` is missing or exists, **When** install runs, **Then** the same create / marker-update policy applies.
5. **Given** `.cursor/rules/codefence-guardrails.mdc` is missing, **When** install runs, **Then** the rule file is written; if it exists, only this file is updated (dedicated rule file).
6. **Given** `--dry-run`, **When** install runs, **Then** no files are written.

### User Story 2 — `.gitignore` for `.codefence/` (Priority: P1)

**Why this priority**: Local cache/debounce state must not be committed.

**Independent test**: Missing `.gitignore` gains `.codefence/`; existing file appends the entry only if missing.

**Acceptance scenarios**:

1. **Given** `.gitignore` is missing, **When** install runs, **Then** it is created/updated to include `.codefence/`.
2. **Given** `.gitignore` exists without `.codefence/`, **When** install runs, **Then** `.codefence/` is appended.
3. **Given** `.gitignore` already lists `.codefence/`, **When** install runs again, **Then** the entry is not duplicated.

### User Story 3 — Template content for binary + MCP (Priority: P1)

**Why this priority**: Agents must prefer the `codefence` binary and MCP tools when available.

**Independent test**: Embedded templates instruct the three behaviors below; marker names remain stable.

**Acceptance scenarios**:

1. **Given** installed guardrail text, **When** agents follow it, **Then** they prefer `codefence scan --staged` until exit 0.
2. **Given** MCP is configured, **When** agents choose a path, **Then** templates instruct preferring MCP tools (`scan`, `get_findings`, …) over shelling out repeatedly.
3. **Given** the binary is present, **When** agents interact with users, **Then** templates instruct not telling users to run scans unless the binary is missing.
4. **Given** a repo that already has Codefence guardrail markers, **When** `install` runs again, **Then** stable marker names prevent duplicated guardrail blocks.

### Edge cases

- Partial existing files with only one marker → behavior must remain non-destructive and unambiguous (preserve outside content; update/replace only the marked region when both markers present — do not invent new marker schemes).
- Embed source of truth is `templates/ai/*` via `go:embed`.

## Requirements

### Functional requirements

- **FR-001**: `codefence install` MUST merge guardrails into `AGENTS.md`, `.claude/CLAUDE.md`, `.github/copilot-instructions.md`, and `.cursor/rules/codefence-guardrails.mdc` per the create-vs-update policy in this feature's acceptance scenarios.
- **FR-002**: Marker names MUST remain `<!-- codefence-guardrails:start -->` / `<!-- codefence-guardrails:end -->`.
- **FR-003**: Install MUST support `--dry-run` (no writes).
- **FR-004**: Install MUST ensure `.gitignore` includes `.codefence/` (create or append if missing).
- **FR-005**: Templates MUST instruct: prefer `codefence scan --staged` until exit 0; prefer MCP tools when configured; do not tell users to run scans unless the binary is missing.
- **FR-006**: Templates MUST be shipped via `go:embed` from `templates/ai/*`.
- **FR-007**: Double install MUST be idempotent (no duplicated markers/sections).

### Non-goals

- Overwriting entire user instruction files outside markers.
- Inventing new assistant targets beyond those listed.
- Implementing the MCP server itself (feature `012`) — only template mentions.
- Changing marker names (breaks re-install without duplication).

## Success criteria

- **SC-001**: Merge tests prove user content outside markers is preserved.
- **SC-002**: Idempotent double-install test passes.
- **SC-003**: dry-run writes nothing.
- **SC-004**: Docs (`docs/ai-assistants.md`) reflect binary + MCP guidance.

## Assumptions

- MCP tool names referenced in templates match feature `012-mcp-server`.
- `.codefence/` local state layout matches `002-config-and-env`.

## Open questions

_(none beyond keeping markers stable.)_

## References

- Related: `012-mcp-server`, `001-cli-and-commands`, `global/compatibility.md`
- Docs: `docs/ai-assistants.md`
- Templates: `templates/ai/*`
