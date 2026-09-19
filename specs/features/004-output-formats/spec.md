---
title: "Output Formats"
id: 4
slug: "output-formats"
status: specified
authors: ["@kadraman"]
created: 2026-09-19
updated: 2026-09-19
issue: "https://github.com/kadraman/codefence/issues/4"
area: output
related:
  - 003-finding-model
  - global/architecture
---

# Feature Specification: Output Formats

## Summary

Support `table` and `json` (NDJSON) output formats with quiet/verbose controls. CLI `--format json` must preserve the **existing NDJSON wire shape** (not the internal Finding field names from `003-finding-model`).

## Problem

Humans need readable tables in terminals; agents and CI need machine-parseable streams. Mixing progress onto stdout breaks JSON consumers. Treating the Finding schema as the CLI JSON contract would silently break parsers that claim CLI parity.

## User scenarios

### User Story 1 — Table vs JSON stream destinations (Priority: P1)

**Why this priority**: Wrong stream routing breaks CI and humans alike.

**Independent test**: Run fixture scan in table and json modes; assert destinations and quiet defaults.

**Acceptance scenarios**:

1. **Given** `--format table` (default), **When** findings are printed, **Then** colored tables go to **stderr**, progress/aspect status to **stdout**, supplemental detail to **stderr**.
2. **Given** `--format json`, **When** findings are printed, **Then** NDJSON is on **stdout** (one object/line); progress on **stderr** when not quiet.
3. **Given** `--format json`, **When** quiet defaults apply, **Then** progress is quiet unless `--verbose`; `--quiet` suppresses human progress; `--verbose` forces progress on stderr.
4. **Given** JSON mode, **When** scanning, **Then** no progress lines appear on stdout.

### User Story 2 — NDJSON wire contract and Finding mapper (Priority: P1)

**Why this priority**: Wire key stability is a constitution core contract.

**Independent test**: Finding → wire unit tests and golden NDJSON asserting wire keys (`filename`, `location`, `package`, …), never Finding names on stdout.

**Acceptance scenarios**:

1. **Given** a Finding, **When** mapped to CLI NDJSON, **Then** wire fields match the contract table (including `fixed` formatting and `location` object).
2. **Given** secret findings, **When** emitted, **Then** `category` is `"code"` and `kind` is `"secret"` — never `category: "secret"` or `"deps"`.
3. **Given** deps findings, **When** emitted, **Then** `category` is `"dependency"` (not `"deps"`).
4. **Given** warnings, **When** printed as JSON, **Then** warning objects use `category: "warning"` and the warning field set.

### Edge cases

- Key **order** need not be fixed; key **names and value shapes** must match the contract.
- `fixed` is `">= " + fixedVersion` when set, else `null` (not raw `fixedVersion`).
- `location` is `{ "line": <int> }` when `line > 0`, else `null`.
- Fields **not** emitted on the wire: `filePath`, `line`, `packageName`, `packageVersion`, `fixedVersion`, `cveId`.
- MCP does **not** use table mode or CLI NDJSON; MCP returns Finding-shaped JSON (003).
- Color tables degrade when not a TTY.

## Requirements

### Functional requirements

- **FR-001**: Formats MUST behave:

  | Format | Findings destination | Progress / aspect status | Supplemental detail |
  | ------ | -------------------- | ------------------------ | ------------------- |
  | `table` (default) | **stderr** colored tables | **stdout** | **stderr** |
  | `json` | **NDJSON** on **stdout** | **stderr** when not quiet | **stderr** |

- **FR-002**: Quiet/verbose: `--format json` quiet unless `--verbose`; `--quiet` suppresses progress; `--verbose` forces stderr progress.
- **FR-003**: CLI NDJSON finding object MUST include:

  | Wire field | Type | Notes / Finding source |
  | ---------- | ---- | ---------------------- |
  | `category` | string | Exact values only: `"code"` (secure-coding **and** secret findings from the `code` aspect) or `"dependency"` (deps aspect). Do **not** emit `"deps"` or `"secret"` as `category`. |
  | `severity` | string | Finding `severity` |
  | `package` | string \| null | Finding `packageName` |
  | `version` | string \| null | Finding `packageVersion` |
  | `fixed` | string \| null | `">= " + fixedVersion` when set; else `null` |
  | `cve` | string \| null | Finding `cveId` |
  | `filename` | string | Repo-relative path from Finding `filePath` |
  | `location` | object \| null | `{ "line": <int> }` when `line > 0`; else `null` |
  | `ruleId` | string | Finding `ruleId` |
  | `advisoryId` | string \| null | Finding `advisoryId` |
  | `message` | string | Finding `message` |
  | `confidence` | string \| null | Finding `confidence` |
  | `evidence` | string \| null | Finding `evidence` |
  | `remediation` | string \| null | Finding `remediation` |
  | `kind` | string \| null | `"secret"` \| `"dependency"` \| `"code"` — not `category` |
  | `detectionMethod` | string \| null | Finding `detectionMethod` |

- **FR-004**: System MUST provide an explicit Finding → wire mapper (no accidental Finding JSON tags on stdout).
- **FR-005**: NDJSON warning objects MUST include: `category` (`"warning"`), `aspect` (`"code"` \| `"deps"`), `code`, `message`, `filename`, `remediation`.
- **FR-006**: Dependency table rows MAY aggregate per `package@version`; column labels are human-facing and independent of NDJSON keys.
- **FR-007**: MCP MUST NOT use table mode or CLI NDJSON projection.
- **FR-008**: Color tables MUST degrade when not a TTY.

### Non-goals

- Finding-shaped CLI JSON as v1 default (future only behind versioned format / `schemaVersion`).
- Changing wire key names without a versioned migration.

## Success criteria

- **SC-001**: Stream destinations match FR-001.
- **SC-002**: CLI NDJSON fields match the FR-003 wire contract.
- **SC-003**: Explicit Finding → wire mapper; goldens assert wire keys.
- **SC-004**: Secret findings emit `category: "code"` with `kind: "secret"`.

## Assumptions

- Findings come from `003-finding-model`.
- Scan orchestrator invokes output writers after aspect runs.

## Open questions

- None; issue link remains TBD.

## References

- Related: [`003-finding-model`](../003-finding-model/), product-vision NDJSON stability non-goal
