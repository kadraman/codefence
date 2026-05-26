import path from "node:path";
import { getChangedFiles } from "../git";
import { expandScanPaths } from "../scanner";
import { codeAspect } from "./aspects/code";
import { depsAspect } from "./aspects/deps";
import { writeScanLog, writeScanStatus } from "./output";
import { resolveAspects } from "./parseOptions";
import { AspectId, AspectOutcome, ScanAspect, ScanContext, ScanOptions } from "./types";

const ASPECT_REGISTRY: Record<AspectId, ScanAspect> = {
  code: codeAspect,
  deps: depsAspect
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
  const context = buildScanContext(options);
  const aspects = resolveAspects(options, context.files);

  if (aspects.length === 0) {
    console.error("No scan aspects selected. Use --only or adjust CODEFENCE_ASPECTS / --skip.");
    return 1;
  }
  const outcomes: AspectOutcome[] = [];
  const output = options;

  writeScanStatus(
    `Running scan aspects: ${aspects.join(", ")} (${context.files.length} file(s) in scope)`,
    output
  );

  for (const aspectId of aspects) {
    const aspect = ASPECT_REGISTRY[aspectId];
    writeScanStatus(`\n--- ${aspect.label} (${aspect.id}) ---`, output);
    const outcome = await aspect.run(context);
    outcomes.push(outcome);

    const statusLabel = outcome.status.toUpperCase();
    const detail = outcome.message ? ` — ${outcome.message}` : "";
    writeScanStatus(`[${aspect.id}] ${statusLabel}${detail}`, output);
  }

  const failed = outcomes.filter((o) => o.status === "failed");
  const exitCode = failed.reduce((max, o) => Math.max(max, o.exitCode), 0);

  if (failed.length === 0) {
    writeScanStatus("Scan completed successfully.", output);
    return exitCode;
  }

  writeScanLog(`Scan failed: ${failed.map((o) => o.aspect).join(", ")}`, output);
  return exitCode || 1;
}
