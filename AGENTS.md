# Agent instructions (all tools)

**Automatic behavior — do not wait for the user to ask.**

## Before you finish any task that changed code

1. **Run** in the terminal (you execute it, not the user):
   ```bash
   codefence scan --staged
   ```
   Use `npm run codefence` if defined in `package.json`.

2. **If** `codefence scan` fails, fix secure-coding findings and re-run until exit 0.

3. **Only then** report the task complete.

**Do not** tell the user to run these commands unless the `codefence` CLI is missing (`npm i codefence`).

## Prerequisites (repo)

`codefence` on PATH (or `npm run codefence`). See [README.md](README.md).
