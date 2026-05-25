# GitHub Copilot — Codefence guardrails

**You must run guardrails automatically. Do not tell the user to run scans unless the `codefence` CLI is missing.**

## Before finishing any task that changed code

1. Run `codefence scan --staged` (or `npm run codefence` if defined).
2. If the scan fails, fix secure-coding findings and re-run until exit 0.
3. Only then mark the task complete.

**Session start:** no special setup beyond having `codefence` available.

**Never** complete while scans fail unless the user explicitly waives risk.

## Prerequisites

`codefence` from `npm i codefence`. `.codefence/` is gitignored (local cache).
