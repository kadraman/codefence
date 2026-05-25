#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${1:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

if [[ -f "$ROOT/dist/src/cli.js" ]]; then
  exec node "$ROOT/dist/src/cli.js" install-hooks "${@:2}"
fi
if command -v codefence >/dev/null 2>&1; then
  exec codefence install-hooks "${@:2}"
fi
echo "Build codefence first (npm run build) or install codefence globally." >&2
exit 1
