import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const CODEFENCE_OUTPUT_DIR = ".codefence";
/** @deprecated Use {@link CODEFENCE_OUTPUT_DIR}. */
export const DSEC_OUTPUT_DIR = CODEFENCE_OUTPUT_DIR;
/** @deprecated Use {@link CODEFENCE_OUTPUT_DIR}. */
export const FGR_OUTPUT_DIR = CODEFENCE_OUTPUT_DIR;

export const CACHE_VERSION = 1;
export const DEFAULT_DEBOUNCE_SECONDS = 2;

export function workspaceHash(workspace: string): string {
  return crypto.createHash("sha256").update(path.resolve(workspace)).digest("hex").slice(0, 8);
}

export function codefenceDir(workspace: string): string {
  return path.join(path.resolve(workspace), CODEFENCE_OUTPUT_DIR);
}

/** @deprecated Use {@link codefenceDir}. */
export const dsecDir = codefenceDir;

export function cacheDir(workspace: string): string {
  return path.join(codefenceDir(workspace), "cache");
}

export function codeCachePath(workspace: string, relativePath: string): string {
  const safe = relativePath.replace(/\\/g, "/").replace(/[/:]/g, "_");
  return path.join(cacheDir(workspace), "code", `${safe}.json`);
}

export function debounceStatePath(workspace: string): string {
  return path.join(codefenceDir(workspace), "debounce.json");
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function normalizeRelativePath(workspace: string, filePath: string): string {
  const workspacePath = path.resolve(workspace);
  const target = path.isAbsolute(filePath) ? path.resolve(filePath) : path.resolve(workspacePath, filePath);
  return path.relative(workspacePath, target).replace(/\\/g, "/");
}

export function isPathInsideWorkspace(workspace: string, filePath: string): boolean {
  const workspacePath = path.resolve(workspace);
  const target = path.resolve(workspacePath, filePath);
  const relative = path.relative(workspacePath, target);
  return relative !== ".." && !relative.startsWith(`..${path.sep}`);
}
