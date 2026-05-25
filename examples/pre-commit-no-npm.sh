#!/usr/bin/env bash
# Legacy Bash wrapper — prefer: codefence install-hooks (installs a Node pre-commit hook).
# Manual install: cp hooks/git/pre-commit.cjs .git/hooks/pre-commit && cp hooks/lib/run-codefence-hook.cjs .git/hooks/codefence-run-hook.cjs
# Or on Windows: codefence install-hooks

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$(git rev-parse --show-toplevel)"
exec node "$ROOT/hooks/git/pre-commit.cjs" "$@"
