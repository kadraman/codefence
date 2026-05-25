---
title: "Semgrep-Compatible Secret Engine"
status: implemented
owners: ["@kadraman"]
created: 2026-05-25
updated: 2026-05-25
issue: "TBD"
scope: "scan|rules|cli|docs"
---

## Summary

This feature adds a high-performance secret-scanning engine to Codefence that supports Semgrep-style YAML rules and entropy-based detection for unknown credential formats. The engine combines deterministic rule matching with statistical heuristics to detect API keys, tokens, private keys, and other high-entropy secrets in source code and configuration files. It is designed to remain lightweight, embeddable, and language-agnostic so it can run in local developer workflows, CI pipelines, and security platforms.

## Problem Statement

Codefence currently provides local secure-coding scanning, but secret detection is mostly regex/rule-driven and does not provide a Semgrep-compatible rules layer plus entropy-based discovery in one cohesive engine. This creates two gaps:

1. Rule portability: teams cannot easily re-use Semgrep-style YAML detection rules.
2. Unknown format detection: emerging credential formats that do not match known patterns may be missed.

Without these capabilities, users may either miss real secrets or need additional scanners in CI, increasing complexity and maintenance overhead.

## Proposed Solution

### Behavior

The engine should:

1. Ship with a built-in default rule set for common secret types.
2. Load secret rules from Semgrep-style YAML definitions (subset compatible with Codefence runtime constraints).
2. Run pattern-based matching on candidate files selected by existing scan orchestration.
3. Run entropy-based analysis to detect likely secrets that do not match known patterns.
4. Correlate and deduplicate findings from rule and entropy passes.
5. Emit normalized findings with severity, confidence, evidence summary, and remediation guidance.
6. Respect existing scan controls (`--paths`, `--staged`, `--only`, `--skip`) and ignored path behavior.
7. Support updating local rule packs from a remote source and reuse cached copies for offline and low-latency scans.

### Built-In Default Rules

The engine should include a default built-in rules pack enabled automatically unless explicitly disabled. Initial built-in categories:

1. API keys and service tokens (for example cloud/provider token formats)
2. Generic bearer/access token patterns
3. Private key material and PEM blocks
4. Password-like assignments in code and config
5. VCS/platform tokens (for example GitHub/GitLab-style token prefixes)
6. High-confidence URI credential embeddings
7. Entropy-assisted generic secret assignment rules

The built-in rules should be versioned, testable, and distributed with the Codefence package.

### CLI Surface

Proposed updates to `codefence scan`:

1. Add rule input:
   - `--secret-rules <path-or-dir>` (optional; supports multiple YAML files)
2. Add built-in rule controls:
   - `--secret-default-rules <on|off>` (default: on)
   - `--secret-default-rules-version <version>` (optional; informational/selective if multiple bundled versions exist)
3. Add remote rule update controls:
   - `--secret-rules-update-url <url>` (remote Semgrep-style rule bundle endpoint)
   - `--secret-rules-refresh` (force refresh from remote and update cache)
   - `--secret-rules-cache-ttl <duration>` (for example 24h)
4. Add entropy tuning:
   - `--secret-entropy-threshold <number>` (for example `3.5` to `5.0`)
   - `--secret-min-length <number>` (default to avoid noisy short strings)
5. Add confidence filter:
   - `--secret-min-confidence <low|medium|high>`

No behavior change expected for:

- `codefence install`
- `codefence install-hooks`
- `codefence pre-commit`
- `codefence background-scan`

These commands should automatically benefit from improved `scan` results when they invoke scanning.

### Config And Environment

Proposed environment variables:

1. `CODEFENCE_SECRET_RULES`
2. `CODEFENCE_SECRET_DEFAULT_RULES`
3. `CODEFENCE_SECRET_RULES_UPDATE_URL`
4. `CODEFENCE_SECRET_RULES_CACHE_TTL`
5. `CODEFENCE_SECRET_ENTROPY_THRESHOLD`
6. `CODEFENCE_SECRET_MIN_LENGTH`
7. `CODEFENCE_SECRET_MIN_CONFIDENCE`

Rule cache location should default under `.codefence/` in the target repository, with metadata for source URL, fetch time, checksum, and TTL.

Existing environment variables (`CODEFENCE_ASPECTS`, `CODEFENCE_ONLY`, `CODEFENCE_SKIP`) remain supported.

### Examples

Use Semgrep-compatible rules with entropy scanning:

```bash
codefence scan --staged --secret-rules .codefence/rules/secrets
```

Update local rules from remote source and refresh cache:

```bash
codefence scan --staged --secret-rules-update-url https://example.com/codefence/secrets-rules.yml --secret-rules-refresh
```

Tune entropy sensitivity for CI:

```bash
codefence scan --paths src config --secret-entropy-threshold 4.2 --secret-min-confidence medium
```

Example finding (normalized):

```text
[high] secret-high-entropy
file: src/config.ts:18
confidence: medium
message: Potential hardcoded secret detected via entropy heuristic
evidence: token-like string length=40 entropy=4.68
```

Built-in rules only (no custom rule path):

```bash
codefence scan --staged --secret-default-rules on
```

## Implementation Plan

### Areas Touched

Expected implementation areas:

1. `src/scan/*` for orchestration and options parsing
2. `src/rules/*` for shared finding model and secret rule interfaces
3. New engine modules under `src/scan/aspects/` or `src/scan/secret/` (parser, matcher, entropy analyzer)
4. `src/cli.ts` and `src/scan/parseOptions.ts` for CLI flags and help text
5. `src/scan` cache handling modules for remote rules metadata and TTL checks
6. `tests/*` for engine, parser, CLI, cache, and integration coverage
7. `examples/` and test fixture directories for built-in rule sample files
8. `README.md` and `docs/*` for user-facing behavior

### Step-by-Step Plan

1. Define rule schema adapter for Semgrep-style YAML subset used by secret scanning.
2. Implement rule loader with validation and helpful errors.
3. Implement pattern matching executor with file/language agnostic line scanning.
4. Implement entropy analyzer with configurable threshold, min length, and suppressions.
5. Implement finding merger and deduplication logic with confidence scoring.
6. Wire new secret-scanning options into scan parser and runner.
7. Add built-in default rules pack and version metadata bundled with package.
8. Implement remote rule download, checksum verification, cache persistence, and TTL-based refresh logic.
9. Add output formatting updates for confidence and evidence fields.
10. Add sample fixture files that intentionally trigger built-in rules (API keys, tokens, private keys, high-entropy values).
11. Add tests and fixtures for both known-format and unknown-format secret detection.
12. Update docs and examples.
13. Roll out as the single built-in secret engine.

### Backward Compatibility

Backward compatible by default:

1. Existing scan entry points (`scan`, hooks, pre-commit) remain unchanged.
2. Existing rules and commands continue to work.
3. New secret options are additive and optional.
4. Built-in rules are enabled by default; users can layer local and remote rules without losing defaults.

Breaking changes (if any) should only occur in a later version once migration guidance is published.

### Security Considerations

Benefits:

1. Better coverage for unknown or evolving secret formats.
2. Reduced blind spots from regex-only detection.

Risks:

1. False positives from high-entropy benign strings.
2. Rule portability mismatches if Semgrep features exceed supported subset.

Mitigations:

1. Confidence scoring and minimum-confidence filtering.
2. Entropy min-length and threshold controls.
3. Clear rule schema validation and compatibility warnings.
4. Optional allowlist/ignore support for known benign tokens.
5. Remote rule updates require integrity checks (checksum/signature) before cache activation.

## Testing Strategy

### Unit Tests

Add or update tests for:

1. YAML rule parsing and schema validation
2. Pattern matching engine behavior
3. Entropy scoring and threshold boundaries
4. Finding deduplication and confidence scoring
5. CLI argument parsing for new flags
6. Remote rule fetch, cache read/write, TTL expiry, and refresh behavior
7. Built-in rule coverage against sample fixture files

Suggested files:

1. `tests/secretEngine.rules.test.ts`
2. `tests/secretEngine.entropy.test.ts`
3. `tests/secretEngine.merge.test.ts`
4. `tests/scanOptions.test.ts` (extend)
5. `tests/secretEngine.cache.test.ts`
6. `tests/secretEngine.builtinRules.spec.ts`
7. `tests/secrets/fixtures/*` sample files for built-in rule triggers

### CLI/Integration Tests

1. `codefence scan --secret-rules <dir>` returns expected findings.
2. `--secret-min-confidence` filters noisy findings.
3. `--staged` and `--paths` continue to scope files correctly.
4. Hook-driven flows (`pre-commit`, `background-scan`) invoke the same secret engine behavior.
5. Remote update path populates cache and subsequent scans work without network access.
6. Built-in rules detect expected secrets from provided sample files.

### Required Validation Commands

```bash
npm test
npm run codefence
```

Feature is not complete until both commands pass.

## Migration Path

1. Introduce feature as the default single secret engine behavior.
2. Publish migration guide with recommended thresholds, built-in rule catalog, and sample rules.
3. Encourage CI pilots with confidence filter set to `high` or `medium`.
4. Evaluate false-positive and false-negative telemetry from pilot users.
5. Tune defaults in later releases based on telemetry and user feedback.

## Implementation Checklist

- [ ] Behavior is documented and unambiguous
- [ ] Semgrep-style rule loader implemented
- [ ] Built-in default rules pack implemented and versioned
- [ ] Entropy analyzer implemented and configurable
- [ ] Secret engine behavior wired into `codefence scan`
- [ ] Remote rules update + cache behavior implemented
- [ ] Sample fixture files added for built-in rule validation
- [ ] Findings include confidence and evidence
- [ ] Tests added/updated
- [ ] `npm test` passes
- [ ] `npm run codefence` passes
- [ ] User-facing docs updated

## Future Enhancements

1. Inline secret validation plugins (for example token format validators)
2. Repository-level baseline mode for existing known findings
3. Rule performance profiling and automatic optimization hints
4. IDE quick-fix suggestions and remediation snippets
5. Extended Semgrep compatibility coverage
6. Signed remote rule manifests with key rotation policy

## Open Questions

1. Which Semgrep YAML fields are required in v1 compatibility scope?
2. Should entropy scoring be language-aware for comment/string handling in v1?
3. What confidence model should be exposed publicly versus internal-only?
4. Which defaults should we choose for entropy threshold and confidence in v1?
5. Do we need an official allowlist format in v1?
6. Which remote transports and auth methods are in scope for rule updates?

## References

1. Codefence README and scan command behavior
2. Codefence CONTRIBUTING guidelines
3. Semgrep rule syntax references (subset compatibility target)
4. Existing Codefence secret-detection tests and findings model

## Additional Notes

This feature should preserve Codefence's lightweight and embeddable nature. Performance and deterministic output are as important as detection quality. Any heavy dependency should be justified against startup time, memory footprint, and cross-platform compatibility.
