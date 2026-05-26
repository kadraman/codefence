
<!-- codefence-guardrails:start -->
## Codefence guardrails (automatic)

**Run scans yourself. Do not wait for the user to ask.**

### Before finishing any task that changed code

1. Run in the terminal: `codefence scan --staged` (or `npm run codefence`).
2. Fix any findings reported by the scan (dependency manifests in the change set also trigger vulnerability checks).
3. Repeat until `codefence scan --staged` exits 0.

**Do not** complete the task while scans fail unless the user explicitly waives risk.

Prereqs: `codefence` CLI (`npm i codefence`).

<!-- codefence-guardrails:end -->
