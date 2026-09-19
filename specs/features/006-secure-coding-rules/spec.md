---
title: "Secure-Coding Rules"
id: 6
slug: "secure-coding-rules"
status: specified
authors: ["@kadraman"]
created: 2026-09-19
updated: 2026-09-19
issue: "https://github.com/kadraman/codefence/issues/6"
area: secure-coding
---

# Feature Specification: Secure-Coding Rules

## Summary

Implement the built-in secure-coding line rules that run as part of the `code` aspect alongside the secret engine. Rules emit `Finding` with `kind: code`; any finding fails the `code` aspect (exit 1).

## Problem

AI assistants may introduce `eval`, `shell: true`, or `http://` endpoints. These lightweight checks catch common insecure patterns without a full SAST engine.

## User scenarios

### User Story 1 — Built-in line rules (Priority: P1)

**Why this priority**: These three rules are the v1 secure-coding surface agents and CI rely on.

**Independent test**: Unit tests per rule with positive/negative lines; fixtures under `testdata/code/`.

**Acceptance scenarios**:

1. **Given** a scannable file containing `\beval\s*\(` or `\bnew\s+Function\s*\(`, **When** the `code` aspect runs, **Then** a finding with ID `no-eval`, severity `high`, and `kind: code` is emitted.
2. **Given** a scannable file containing `shell\s*:\s*true`, **When** the `code` aspect runs, **Then** a finding with ID `no-shell-true`, severity `medium`, and `kind: code` is emitted.
3. **Given** a scannable file containing `http://` not followed by `localhost` or `127.0.0.1`, **When** the `code` aspect runs, **Then** a finding with ID `no-insecure-http`, severity `medium`, and `kind: code` is emitted.
4. **Given** `http://localhost` or `http://127.0.0.1`, **When** the `code` aspect runs, **Then** `no-insecure-http` does **not** fire for that occurrence.
5. **Given** any secure-coding finding, **When** the `code` aspect completes, **Then** the aspect fails (exit 1).

### User Story 2 — File filtering and scan loop (Priority: P1)

**Why this priority**: Wrong file set causes false positives/negatives.

**Independent test**: Filter tests for scannable extensions / ignore logic.

**Acceptance scenarios**:

1. **Given** files in the `code` aspect, **When** scanning, **Then** only scannable extensions / config-like sources are scanned; binaries and known heavy dirs are skipped.
2. **Given** a rule that defines `windowSize` / windowed test, **When** matching, **Then** an optional sliding window is supported (API reserved for future rules; v1 three rules are line-oriented).

### Edge cases

- What happens when a file matches multiple rules on the same line?
- What happens when `--skip code` or `--only deps` excludes the `code` aspect?

## Requirements

### Functional requirements

- **FR-001**: System MUST scan each scannable file in the `code` aspect line-by-line (and optional sliding window when a rule defines `windowSize` / windowed test).
- **FR-002**: System MUST emit `Finding` with `kind: code` for rule matches.
- **FR-003**: System MUST fail the `code` aspect (exit 1) when any secure-coding finding is produced.
- **FR-004**: System MUST implement built-in rule `no-eval` — severity `high` — detection `\beval\s*\(` or `\bnew\s+Function\s*\(` — message intent: avoid eval/new Function.
- **FR-005**: System MUST implement built-in rule `no-shell-true` — severity `medium` — detection `shell\s*:\s*true` — message intent: avoid shell-enabled child_process.
- **FR-006**: System MUST implement built-in rule `no-insecure-http` — severity `medium` — detection `http://` not followed by localhost/127.0.0.1 — message intent: prefer HTTPS.
- **FR-007**: System MUST scan source and config-like files only; skip binaries and known heavy dirs.
- **FR-008**: System MUST wire secure-coding into the `code` aspect together with the secret engine (ordering: before/with secrets).
- **FR-009**: Control surface is aspect flags only (`--only code` / `--skip code` and path scoping); no dedicated secure-coding CLI flags in v1.

### Built-in rules (v1)

| ID | Severity | Detection | Message intent |
| -- | -------- | --------- | -------------- |
| `no-eval` | high | `\beval\s*\(` or `\bnew\s+Function\s*\(` | Avoid eval/new Function |
| `no-shell-true` | medium | `shell\s*:\s*true` | Avoid shell-enabled child_process |
| `no-insecure-http` | medium | `http://` not followed by localhost/127.0.0.1 | Prefer HTTPS |

### Non-goals

- YAML-defined secure-coding rules (out of scope for v1; secrets already use YAML).
- Full SAST / taint analysis.
- Changing finding schema fields (owned by feature `003`).

## Success criteria

- **SC-001**: Three rules ship with the IDs and severities in the built-in rules table.
- **SC-002**: Unit tests per rule with positive/negative lines pass.
- **SC-003**: Fixture files under `testdata/code/` exercise end-to-end `code` aspect findings.
- **SC-004**: Windowed-rule API is reserved if needed for future rules without inventing new v1 rules.

## Assumptions

- Finding type and severity enums come from feature `003`.
- Secret engine is feature `007`; this feature owns only the three line rules and their wiring into `code`.

## Open questions

_(none; IDs and severities MUST match the built-in rules table; message text may vary slightly)_

## References

- Related: `005-scan-orchestrator`, `007-secret-engine`, `003-finding-model`
