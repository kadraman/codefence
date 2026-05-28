import fs from "node:fs";
import path from "node:path";
import { DependencyCoordinate } from "../types";

export const NPM_ECOSYSTEM = "npm";
const BYTES_PER_MIB = 1024 * 1024;
const MAX_LOCKFILE_MIB = 10;
export const MAX_LOCKFILE_BYTES = MAX_LOCKFILE_MIB * BYTES_PER_MIB;

export interface DependencyExtractionResult {
  dependencies: DependencyCoordinate[];
  warnings: string[];
}

export function normalizeExactVersion(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (/^[v=]?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(trimmed)) {
    return trimmed.replace(/^[v=]+/, "");
  }

  return null;
}

function stripNpmAliasPrefix(raw: string): string {
  if (!raw.startsWith("npm:")) {
    return raw;
  }

  const aliasTarget = raw.slice(4);
  if (aliasTarget.startsWith("@")) {
    const match = aliasTarget.match(/^@[^/]+\/[^@]+@(.+)$/);
    return match?.[1] ?? aliasTarget;
  }

  const match = aliasTarget.match(/^[^@]+@(.+)$/);
  return match?.[1] ?? aliasTarget;
}

export function normalizeInstalledVersion(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (
    trimmed.startsWith("file:") ||
    trimmed.startsWith("link:") ||
    trimmed.startsWith("workspace:")
  ) {
    return null;
  }

  const normalized = stripNpmAliasPrefix(trimmed)
    .replace(/^[v=]+/, "")
    .replace(/\([^)]*\)$/g, "")
    .trim();
  if (!normalized || /^[~^*<>]/.test(normalized)) {
    return null;
  }
  return normalizeExactVersion(normalized);
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesPattern(line: string, pattern: string | RegExp): boolean {
  if (typeof pattern === "string") {
    return line.includes(pattern);
  }
  return pattern.test(line);
}

export function findBestEffortLine(source: string, patterns: Array<string | RegExp>): number {
  const lines = source.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    if (patterns.every((pattern) => matchesPattern(lines[index], pattern))) {
      return index + 1;
    }
  }
  for (let index = 0; index < lines.length; index++) {
    if (patterns.some((pattern) => matchesPattern(lines[index], pattern))) {
      return index + 1;
    }
  }
  return 0;
}

export function findPackageJsonDependencyLine(source: string, packageName: string): number {
  return findBestEffortLine(source, [new RegExp(`"${escapeRegExp(packageName)}"\\s*:`)]);
}

export function dedupeCoordinates(dependencies: DependencyCoordinate[]): DependencyCoordinate[] {
  const seen = new Set<string>();
  const deduped: DependencyCoordinate[] = [];
  for (const dependency of dependencies) {
    const key = `${dependency.ecosystem}:${dependency.name}:${dependency.version}:${dependency.manifestPath}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(dependency);
  }
  return deduped;
}

export function readManifestSource(
  manifestPath: string,
  options?: { maxBytes?: number }
): { absolutePath: string; source: string | null; warning?: string } {
  const absolutePath = path.resolve(manifestPath);
  if (!fs.existsSync(absolutePath)) {
    return { absolutePath, source: null };
  }

  try {
    const stats = fs.statSync(absolutePath);
    if (options?.maxBytes && stats.size > options.maxBytes) {
      return {
        absolutePath,
        source: null,
        warning: `Skipping ${path.basename(absolutePath)}: file is larger than ${Math.round(options.maxBytes / BYTES_PER_MIB)} MiB.`
      };
    }

    return {
      absolutePath,
      source: fs.readFileSync(absolutePath, "utf8")
    };
  } catch {
    return {
      absolutePath,
      source: null,
      warning: `Unable to read ${path.basename(absolutePath)}.`
    };
  }
}

export function emptyExtractionResult(warning?: string): DependencyExtractionResult {
  return {
    dependencies: [],
    warnings: warning ? [warning] : []
  };
}
