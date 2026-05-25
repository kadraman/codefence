import fs from "node:fs";
import path from "node:path";
import { Finding } from "../types";
import { CACHE_VERSION, cacheDir, codeCachePath, ensureDir } from "./paths";

export interface CodeCacheEntry {
  version: number;
  relativePath: string;
  mtimeMs: number;
  scannedAt: string;
  findings: Finding[];
  status: "ok" | "failed";
}

export function readCodeCache(workspace: string, relativePath: string): CodeCacheEntry | null {
  const filePath = codeCachePath(workspace, relativePath);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const entry = JSON.parse(fs.readFileSync(filePath, "utf8")) as CodeCacheEntry;
    if (entry.version !== CACHE_VERSION || entry.relativePath !== relativePath.replace(/\\/g, "/")) {
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

export function writeCodeCache(workspace: string, relativePath: string, findings: Finding[]): CodeCacheEntry {
  const normalized = relativePath.replace(/\\/g, "/");
  const absPath = path.join(path.resolve(workspace), normalized);
  const mtimeMs = fs.statSync(absPath).mtimeMs;
  const entry: CodeCacheEntry = {
    version: CACHE_VERSION,
    relativePath: normalized,
    mtimeMs,
    scannedAt: new Date().toISOString(),
    findings,
    status: findings.length > 0 ? "failed" : "ok"
  };

  const out = codeCachePath(workspace, normalized);
  ensureDir(path.dirname(out));
  fs.writeFileSync(out, JSON.stringify(entry, null, 2), "utf8");
  return entry;
}

export function getValidCodeCache(workspace: string, relativePath: string): CodeCacheEntry | null {
  const normalized = relativePath.replace(/\\/g, "/");
  const absPath = path.join(path.resolve(workspace), normalized);
  if (!fs.existsSync(absPath)) {
    return null;
  }

  const entry = readCodeCache(workspace, normalized);
  if (!entry) {
    return null;
  }

  const mtimeMs = fs.statSync(absPath).mtimeMs;
  if (entry.mtimeMs !== mtimeMs) {
    return null;
  }

  return entry;
}

export function countCodeCacheHits(workspace: string, relativePaths: string[]): { hits: number; misses: number } {
  let hits = 0;
  let misses = 0;

  for (const rel of relativePaths) {
    if (getValidCodeCache(workspace, rel)) {
      hits++;
    } else {
      misses++;
    }
  }

  return { hits, misses };
}
