#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${1:-.}"

if command -v codefence >/dev/null 2>&1; then
  exec codefence install "${@:2}"
fi

if [[ -f "${ROOT}/dist/src/cli.js" ]]; then
  exec node "${ROOT}/dist/src/cli.js" install "${@:2}"
fi

echo "codefence not found. Install codefence or run npm run build in the codefence repo." >&2
exit 1
