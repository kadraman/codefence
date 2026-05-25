/**
 * Relative path prefixes skipped for git-based code scans (staged/unstaged).
 * Files under these paths are still scanned when passed explicitly via `--paths`.
 */
export const GIT_SCAN_IGNORED_PREFIXES = ["examples/", "tests/sast/", "src/rules/sast/"] as const;

export function formatGitScanIgnoredPrefixes(): string {
  return GIT_SCAN_IGNORED_PREFIXES.join(", ");
}
