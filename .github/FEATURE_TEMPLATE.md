---
title: "<feature-name>"
status: proposed
owners: ["<github-handle>"]
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
issue: "<link-to-issue-or-pr>"
scope: "cli|scan|rules|hooks|install|docs"
---

## Summary

Describe the feature in 2-4 sentences for users of `codefence`.

## Problem Statement

What user pain does this solve? Include current behavior and why it is insufficient.

## Proposed Solution

### Behavior

List expected behavior in concrete terms.

### CLI Surface

Document command changes, if any:

- `codefence scan`
- `codefence install`
- `codefence install-hooks`
- `codefence pre-commit`
- `codefence background-scan`

Include flags, defaults, and error behavior.

### Config And Environment

Document any new/changed environment variables or config inputs.

### Examples

Provide before/after examples, including command lines and sample output when relevant.

## Implementation Plan

### Areas Touched

Identify expected files/folders to change, for example:

- `src/cli.ts`
- `src/scan/*`
- `src/rules/*`
- `src/hooks/*`
- `src/install/*`
- `templates/ai/*`
- `docs/*`

### Step-by-Step Plan

Break implementation into small, reviewable steps.

### Backward Compatibility

State whether this is backward compatible. If not, define migration and communication plan.

### Security Considerations

Describe security impact, false positive/false negative risk, and mitigation.

## Testing Strategy

### Unit Tests

List test files to add/update under `tests/`.

### CLI/Integration Tests

List end-to-end scenarios to validate command behavior.

### Required Validation Commands

```bash
npm test
npm run codefence
```

Feature is not complete until both commands pass.

## Migration Path

If existing users are impacted, provide exact upgrade steps.

## Implementation Checklist

- [ ] Behavior is documented and unambiguous
- [ ] Code implemented in planned areas
- [ ] Tests added/updated
- [ ] `npm test` passes
- [ ] `npm run codefence` passes
- [ ] User-facing docs updated (`README.md`, `docs/AI-ASSISTANTS.md`, `docs/HOOKS.md`, or `CONTRIBUTING.md` as needed)

## Future Enhancements

Optional follow-ups explicitly out of scope for this feature.

## Open Questions

List unresolved decisions that need maintainer input.

## References

Link to relevant docs, PRs, issues, or external references.

## Additional Notes

Any rollout notes, risks, or implementation constraints.
