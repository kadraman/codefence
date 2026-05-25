# Git pre-commit and background scanning

Codefence guardrails provides:

1. A **Git pre-commit hook** (like [Snyk’s secure-at-inception pre-commit](https://github.com/snyk/studio-recipes/blob/main/guardrail_directives/secure_at_inception/kiro_hooks/git/pre-commit)) that runs `codefence scan --staged` and blocks the commit on failure.
2. A **TypeScript background scanner** (like [Snyk’s `background_scanner.py`](https://github.com/snyk/studio-recipes/blob/main/guardrail_directives/secure_at_inception/kiro_hooks/kiro/background_scanner.py)) that scans on save with debouncing and fills `.codefence/cache/` so pre-commit is faster.

These are **not** Kiro-specific for commits — only the optional `afterFileEdit` integration uses Kiro or Cursor hook config.

Hooks are **Node.js scripts** (`.cjs`), not Bash-only — they run on **Windows, macOS, and Linux** as long as Node is on `PATH` (same requirement as `codefence`). Shell scripts (`.sh`) are optional wrappers for Git Bash.

## Install

From your application repo (after `npm install -D codefence`):

```bash
codefence install-hooks
```

This installs:

| Path | Purpose |
| ---- | ------- |
| `.git/hooks/pre-commit` | Node script → `codefence pre-commit` on every `git commit` |
| `.git/hooks/codefence-run-hook.cjs` | Shared helper (copied with pre-commit) |
| `.kiro/hooks.json` | Kiro `afterFileEdit` → `node …/background-scan.cjs` (created if missing) |
| `.cursor/hooks.json` | Cursor `afterFileEdit` → same (created if missing) |

Existing `.kiro/hooks.json` / `.cursor/hooks.json` are **not** overwritten.

From the guardrails repo:

```bash
npm run build
npm run install:hooks
# or: codefence install-hooks
# or (Git Bash): ./hooks/git/install.sh
```

## Test the Git pre-commit hook

### 1. Run the same command Git uses (fastest)

```bash
codefence pre-commit
```

Equivalent to what `.git/hooks/pre-commit` runs after install.

### 2. Run the Node hook directly (Windows-friendly)

```bash
node hooks/git/pre-commit.cjs
```

PowerShell:

```powershell
node hooks\git\pre-commit.cjs
```

### 3. End-to-end with Git

```bash
codefence install-hooks
git add <some-file>
git commit -m "test hook"
```

- Success → commit completes.
- Failure → commit blocked; fix findings or use `git commit --no-verify` to bypass.

## Test the background scanner

### Manual (single file)

```bash
codefence background-scan --file src/example.ts
```

Waits 2 seconds (debounce), then spawns a detached `codefence scan-worker` that writes results under `.codefence/cache/code/`.

On the **first** save of a file, a scan runs immediately. Further saves within the debounce window only reset the timer; one follow-up scan runs after edits stop. The same target is not queued again after an immediate or debounced scan just ran.

### Simulate IDE hook (stdin JSON, Cursor style)

```bash
echo '{"file_path":"src/cli.ts"}' | codefence background-scan
```

PowerShell:

```powershell
'{"file_path":"src/cli.ts"}' | codefence background-scan
```

### Kiro-style env var

```bash
export KIRO_EDITED_FILE=src/cli.ts
codefence background-scan
```

### Worker only (what background-scan spawns)

```bash
codefence scan-worker --type code --target src/cli.ts --workspace .
```

### Debounce / pending queue

```bash
codefence background-scan --file src/foo.ts
sleep 3
codefence background-scan --check-pending
```

## Environment variables

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `CODEFENCE_DEBOUNCE_SECONDS` | `2` | Delay after last save before background scan |
| `CODEFENCE_HOOK_DEBUG` | off | Verbose pre-commit logging |
| `CODEFENCE_HOOK_FAIL_OPEN` | off | Allow commit if pre-commit hook throws |
| `KIRO_EDITED_FILE` | — | File path when Kiro invokes the hook |

## Cache layout

```text
.codefence/
  cache/code/<file>.json   # per-file code scan results (mtime-checked)
  debounce.json            # pending background scans
```

Pre-commit prints cache hit rate for staged code files; run background scans while editing to warm the cache.

## Bypass

```bash
git commit --no-verify
```
