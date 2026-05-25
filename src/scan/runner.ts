import path from "node:path";
import { getChangedFiles } from "../git";
import { expandScanPaths } from "../scanner";
import { codeAspect } from "./aspects/code";
import { resolveAspects } from "./parseOptions";
import { AspectId, AspectOutcome, ScanAspect, ScanContext, ScanOptions } from "./types";

const ASPECT_REGISTRY: Record<AspectId, ScanAspect> = {
  code: codeAspect
};

export function buildScanContext(options: ScanOptions): ScanContext {
  const cwd = process.cwd();
  const files =
    options.paths.length > 0
      ? expandScanPaths(options.paths, cwd).map((file) => path.relative(cwd, file))
      : getChangedFiles(options.staged);

  return {
    cwd,
    files,
    staged: options.staged,
    explicitPaths: options.paths.length > 0,
    options
  };
}

export async function runScan(options: ScanOptions): Promise<number> {
  const aspects = resolveAspects(options);

  if (aspects.length === 0) {
    console.error("No scan aspects selected. Use --only or adjust CODEFENCE_ASPECTS (or DSEC_ASPECTS) / --skip.");
    return 1;
  }

  const context = buildScanContext(options);
  const outcomes: AspectOutcome[] = [];

  console.log(
    `Running scan aspects: ${aspects.join(", ")} (${context.files.length} file(s) in scope)`
  );

  for (const aspectId of aspects) {
    const aspect = ASPECT_REGISTRY[aspectId];
    console.log(`\n--- ${aspect.label} (${aspect.id}) ---`);
    const outcome = await aspect.run(context);
    outcomes.push(outcome);

    const statusLabel = outcome.status.toUpperCase();
    const detail = outcome.message ? ` — ${outcome.message}` : "";
    console.log(`[${aspect.id}] ${statusLabel}${detail}`);
  }

  const failed = outcomes.filter((o) => o.status === "failed");
  const exitCode = failed.reduce((max, o) => Math.max(max, o.exitCode), 0);

  console.log("");
  if (failed.length === 0) {
    console.log("Scan completed successfully.");
    return exitCode;
  }

  console.error(`Scan failed: ${failed.map((o) => o.aspect).join(", ")}`);
  return exitCode || 1;
}
