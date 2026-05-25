#!/usr/bin/env bash
# Optional wrapper for Git Bash — native hook is background-scan.cjs (Node).
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"
exec node "$(dirname "$0")/background-scan.cjs" "$@"
