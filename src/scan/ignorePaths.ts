/**
 * Relative path prefixes skipped for git-based code scans (staged/unstaged).
 * Files under these paths are still scanned when passed explicitly via `--paths`.
 */
export const DEFAULT_GIT_SCAN_IGNORED_PREFIXES = ["examples/"] as const;

export function formatGitScanIgnoredPrefixes(prefixes: readonly string[] = DEFAULT_GIT_SCAN_IGNORED_PREFIXES): string {
  return prefixes.join(", ");
}
