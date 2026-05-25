import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ensureDir } from "../../hooks/paths";
import { DependencyCoordinate, DepsFinding, DepsScanOptions } from "./types";

interface DepsCacheRecord {
  fetchedAt: number;
  findings: DepsFinding[];
}

function depsCacheDir(workspace: string): string {
  return path.join(path.resolve(workspace), ".codefence", "cache", "deps");
}

function makeCacheKey(
  providerUrl: string,
  dependencies: DependencyCoordinate[],
  options: DepsScanOptions
): string {
  const stableDeps = [...dependencies]
    .sort((a, b) => `${a.ecosystem}:${a.name}:${a.version}`.localeCompare(`${b.ecosystem}:${b.name}:${b.version}`))
    .map((dep) => `${dep.ecosystem}:${dep.name}:${dep.version}`);
  const payload = JSON.stringify({
    provider: options.provider,
    providerUrl,
    http2Mode: options.http2Mode,
    dependencies: stableDeps
  });
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function cacheFilePath(
  workspace: string,
  providerUrl: string,
  dependencies: DependencyCoordinate[],
  options: DepsScanOptions
): string {
  return path.join(depsCacheDir(workspace), `${makeCacheKey(providerUrl, dependencies, options)}.json`);
}

export function readDepsCache(
  workspace: string,
  providerUrl: string,
  dependencies: DependencyCoordinate[],
  options: DepsScanOptions
): DepsCacheRecord | null {
  const filePath = cacheFilePath(workspace, providerUrl, dependencies, options);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as DepsCacheRecord;
  } catch {
    return null;
  }
}

export function writeDepsCache(
  workspace: string,
  providerUrl: string,
  dependencies: DependencyCoordinate[],
  options: DepsScanOptions,
  findings: DepsFinding[]
): void {
  const cachePath = cacheFilePath(workspace, providerUrl, dependencies, options);
  ensureDir(path.dirname(cachePath));
  const payload: DepsCacheRecord = {
    fetchedAt: Date.now(),
    findings
  };
  fs.writeFileSync(cachePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export function isDepsCacheFresh(record: DepsCacheRecord, ttlMs: number): boolean {
  if (ttlMs <= 0) {
    return false;
  }
  return Date.now() - record.fetchedAt <= ttlMs;
}

