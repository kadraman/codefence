---
title: "Finding Model and Severity"
id: 3
slug: "finding-model"
status: specified
authors: ["@kadraman"]
created: 2026-09-19
updated: 2026-09-19
issue: "https://github.com/kadraman/codefence/issues/3"
area: findings
related:
  - 004-output-formats
  - global/architecture
---

# Feature Specification: Finding Model and Severity

## Summary

Define a unified `Finding` schema shared by secure-coding, secrets, and dependency aspects, including severity and confidence enums used by the library API, table rendering, and MCP tools. CLI `--format json` NDJSON uses a separate **wire projection** documented in `004-output-formats` — this Finding schema is **not** the CLI NDJSON contract.

## Problem

Agents and CI parsers depend on stable field names. Divergent Finding structs would break library/MCP consumers. Mixing Finding field names with CLI wire keys would silently break NDJSON consumers.

## User scenarios

### User Story 1 — Share one Finding type across aspects (Priority: P1)

**Why this priority**: All scanners, MCP, and tables consume one schema.

**Independent test**: Construct Findings for code, secret, and deps; marshal library/MCP JSON with camelCase tags from the schema table.

**Acceptance scenarios**:

1. **Given** a secure-coding hit, **When** emitted as a Finding, **Then** required fields `ruleId`, `message`, `filePath`, `line`, `severity` are set.
2. **Given** a secret hit, **When** emitted, **Then** optional `confidence`, `evidence`, `kind`, `detectionMethod` may be set.
3. **Given** a deps hit, **When** emitted, **Then** `ruleId` is `vulnerable-dependency` and package/advisory fields may be set.

### User Story 2 — Map severities consistently (Priority: P1)

**Why this priority**: Secret YAML and entropy paths must not invent divergent severity scales.

**Independent test**: Unit tests for YAML/Semgrep severity mapping and entropy bands relative to threshold `T`.

**Acceptance scenarios**:

1. **Given** rule YAML severities `critical|high|medium|low`, **When** mapped, **Then** values pass through as-is.
2. **Given** Semgrep-style `ERROR` / `WARNING` / `INFO`, **When** mapped, **Then** results are `critical` / `medium` / `low`.
3. **Given** entropy-only (no rule match) vs threshold `T`, **When** mapped, **Then** `≥ T+1.0` → `critical`, `≥ T+0.6` → `high`, else `medium`.

### Edge cases

- Do **not** treat this schema as the CLI NDJSON contract (see 004).
- Renaming wire keys requires a versioned migration in 004, not a silent Finding rename.

## Requirements

### Functional requirements

- **FR-001**: System MUST define Finding fields:

  | Field | Type | Required | Notes |
  | ----- | ---- | -------- | ----- |
  | `ruleId` | string | yes | Stable IDs (`no-eval`, `secret-github-token`, `vulnerable-dependency`, …) |
  | `message` | string | yes | Human-readable |
  | `filePath` | string | yes | Repo-relative when possible |
  | `line` | int | yes | 1-based |
  | `severity` | enum | yes | `critical` \| `high` \| `medium` \| `low` |
  | `confidence` | enum | no | `low` \| `medium` \| `high` (secrets) |
  | `evidence` | string | no | Redacted/truncated snippet |
  | `remediation` | string | no | Guidance |
  | `kind` | enum | no | `code` \| `secret` \| `dependency` |
  | `detectionMethod` | enum | no | `rule` \| `entropy` \| `rule+entropy` |
  | `packageName` | string | no | deps |
  | `packageVersion` | string | no | deps |
  | `advisoryId` | string | no | deps |
  | `cveId` | string | no | deps |
  | `fixedVersion` | string | no | deps |

- **FR-002**: Library / MCP JSON tags MUST use camelCase as in the table (`filePath`, `packageName`, `fixedVersion`, `cveId`, …).
- **FR-003**: Secret YAML / Semgrep severity mapping MUST follow: as-is for `critical|high|medium|low`; `ERROR`→`critical`; `WARNING`→`medium`; `INFO`→`low`.
- **FR-004**: Entropy-only severity MUST follow bands relative to threshold `T`: `≥ T+1.0` → `critical`; `≥ T+0.6` → `high`; else `medium`.
- **FR-005**: Deps finding `ruleId` MUST be the constant `vulnerable-dependency`.
- **FR-006**: CLI `--format json` NDJSON MUST NOT use this schema’s field names as the wire contract; mapping lives in `004-output-formats`.

### Non-goals

- Defining CLI NDJSON wire keys (feature 004).
- Inventing additional Finding fields beyond the table.

## Success criteria

- **SC-001**: Exported `findings.Finding` with JSON tags matching this schema (MCP / library).
- **SC-002**: Severity helpers shared by secret + deps.
- **SC-003**: Golden **CLI** NDJSON fixtures use the wire shape in 004, not these Finding names.

## Assumptions

- Table rendering may read Finding fields directly; NDJSON stdout uses the 004 mapper.
- Aspect packages produce Findings; they do not invent alternate structs.

## Open questions

- None; issue link remains TBD.

## References

- Related: [`004-output-formats`](../004-output-formats/)
