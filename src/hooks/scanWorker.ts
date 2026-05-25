import fs from "node:fs";
import path from "node:path";
import { scanFile, shouldScanFile } from "../scanner";
import { writeCodeCache } from "./cache";
import { isPathInsideWorkspace, normalizeRelativePath } from "./paths";

export interface ScanWorkerOptions {
  workspace: string;
  target: string;
}

export async function runScanWorker(options: ScanWorkerOptions): Promise<number> {
  const workspace = path.resolve(options.workspace);
  const target = options.target;

  if (!isPathInsideWorkspace(workspace, target)) {
    console.error(`[scan-worker] Target outside workspace: ${target}`);
    return 1;
  }

  const rel = normalizeRelativePath(workspace, target);
  if (!shouldScanFile(rel)) {
    return 0;
  }

  const absPath = path.join(workspace, rel);
  if (!fs.existsSync(absPath)) {
    console.error(`[scan-worker] File not found: ${rel}`);
    return 1;
  }

  const findings = await scanFile(absPath, { workspace });
  writeCodeCache(workspace, rel, findings);

  if (findings.length > 0) {
    console.error(`[scan-worker] code ${rel}: ${findings.length} finding(s)`);
    for (const f of findings) {
      console.error(`  ${f.severity.toUpperCase()} ${f.ruleId} ${f.filePath}:${f.line}`);
    }
    return 1;
  }

  console.log(`[scan-worker] code ${rel}: ok`);
  return 0;
}

export function parseScanWorkerArgv(argv: string[]): ScanWorkerOptions | null {
  let target: string | null = null;
  let workspace = process.cwd();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--target" && argv[i + 1]) {
      target = argv[++i];
    } else if (arg === "--workspace" && argv[i + 1]) {
      workspace = argv[++i];
    }
  }

  if (!target) {
    return null;
  }

  return { workspace, target };
}
