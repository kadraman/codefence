import { getChangedFiles } from "../git";
import { runScan } from "../scan/runner";
import { defaultSecretScanOptions } from "../scan/secret/config";
import { shouldScanFile } from "../scanner";
import { countCodeCacheHits } from "./cache";

const DEBUG = process.env.CODEFENCE_HOOK_DEBUG === "1" || process.env.DSEC_HOOK_DEBUG === "1";
const FAIL_OPEN = process.env.CODEFENCE_HOOK_FAIL_OPEN === "1" || process.env.DSEC_HOOK_FAIL_OPEN === "1";

function header(title: string): void {
  console.log(`\n=== ${title} ===\n`);
}

export async function runPreCommit(): Promise<number> {
  const start = Date.now();

  try {
    header("Codefence pre-commit");

    const staged = getChangedFiles(true);
    const codeFiles = staged.filter((f) => shouldScanFile(f));

    if (codeFiles.length === 0) {
      console.log("No scannable staged changes.");
      return 0;
    }

    const { hits, misses } = countCodeCacheHits(process.cwd(), codeFiles);
    const total = hits + misses;
    if (total > 0) {
      const rate = total > 0 ? Math.round((hits / total) * 100) : 0;
      console.log(
        `Code cache: ${hits} hit(s), ${misses} miss(es) (${rate}% hit rate). ` +
          "Run background scans while editing to warm the cache."
      );
    }

    if (DEBUG) {
      console.log(`Staged code files: ${codeFiles.length}`);
    }

    const exitCode = await runScan({
      staged: true,
      paths: [],
      only: null,
      skip: [],
      secret: defaultSecretScanOptions()
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    if (exitCode === 0) {
      console.log(`\nSecurity check passed (${elapsed}s). Commit proceeding.`);
      return 0;
    }

    console.error(`\nCommit blocked by Codefence (${elapsed}s).`);
    console.error("Fix findings above, or bypass with: git commit --no-verify");
    return exitCode || 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Pre-commit hook error: ${message}`);
    if (DEBUG && error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    if (FAIL_OPEN) {
      console.error("CODEFENCE_HOOK_FAIL_OPEN=1 — allowing commit despite hook error.");
      return 0;
    }
    return 1;
  }
}
