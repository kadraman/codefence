# Claude Code — Codefence guardrails

**Run scans yourself. Do not wait for the user to ask.**

## Before completing any task that changed code

1. Run `codefence scan --staged` in the terminal.
2. If that fails, fix codefence findings and repeat until exit 0.

If `codefence scan --staged` still exits non-zero, do not mark the task complete unless the user explicitly accepts the risk.

## Session start

No extra steps unless the user asks you to install codefence (`codefence install`).

## Prerequisites

`codefence` CLI (`npm i codefence`). `.codefence/` is gitignored.
