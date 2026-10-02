# Supported Semgrep-subset YAML fields

Secret rule packs use a **documented Semgrep subset** only. Unsupported Semgrep
features are ignored (not invented).

## Document shape

```yaml
rules:
  - id: example-rule
    message: Human-readable finding message
    severity: ERROR          # or critical|high|medium|low|WARNING|INFO
    description: optional
    metadata:
      confidence: high       # low|medium|high (default medium)
      remediation: optional guidance
      case-insensitive: true # optional; also metadata.case_insensitive
    # Pattern fields (at least one required):
    pattern-regex: '...'
    # pattern: 'literal substring'
    # patterns: [ { pattern-regex: '...' }, ... ]
    # pattern-either: [ { pattern: '...' }, ... ]
```

## Supported fields

| Field | Role |
| ----- | ---- |
| `rules` | Top-level array of rule objects |
| `id` | Stable rule ID (required) |
| `message` | Finding message (required) |
| `description` | Optional description (defaults to `id`) |
| `severity` | Semgrep/YAML severity; mapped via `findings.MapRuleSeverity` |
| `metadata.confidence` | `low` \| `medium` \| `high` |
| `metadata.remediation` / `metadata.remediation-guidance` | Remediation text |
| `metadata.case-insensitive` / `case_insensitive` | Apply to `pattern-regex` |
| `options.generic_caseless` / `options.case_sensitive: false` | Same as case-insensitive |
| `pattern-regex` | Regular expression (Go `regexp` syntax) |
| `pattern` | Literal substring match |
| `patterns` | Nested list; patterns are collected (OR semantics for matching) |
| `pattern-either` | Nested list; same collection semantics as `patterns` |

## Explicitly unsupported

Anything beyond the fields above (metavariable-pattern, focus-metavariable,
taint mode, paths include/exclude in-rule, languages, etc.) is **not**
implemented. Extra keys may appear in YAML but are ignored.
