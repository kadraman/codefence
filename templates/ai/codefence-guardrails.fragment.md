
<!-- codefence-guardrails:start -->
## Codefence guardrails (automatic)

**Run scans yourself. Do not wait for the user to ask.**

### Before finishing any task that changed code

1. Prefer MCP tools (`scan`, `get_findings`, …) when `codefence mcp` is configured; otherwise run in the terminal: `codefence scan --staged`.
2. Fix any findings reported by the scan (dependency manifests in the change set also trigger vulnerability checks).
3. Repeat until the scan reports no open findings / exits 0.

**Do not** complete the task while scans fail unless the user explicitly waives risk.

**Do not** tell the user to run scans unless the `codefence` binary is missing from `PATH`.

Prereqs: `codefence` on `PATH` (`go install github.com/kadraman/codefence/cmd/codefence@latest`, or a local release build).

<!-- codefence-guardrails:end -->
