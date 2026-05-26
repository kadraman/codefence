import fs from "node:fs";
import path from "node:path";
import { DependencyCoordinate } from "./types";

const NPM_ECOSYSTEM = "npm";

interface PackageJsonShape {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

function normalizeExactVersion(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (/^[v=]?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(trimmed)) {
    return trimmed.replace(/^[v=]+/, "");
  }

  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findDependencyLine(source: string, packageName: string): number {
  const lines = source.split(/\r?\n/);
  const pattern = new RegExp(`"${escapeRegExp(packageName)}"\\s*:`);
  for (let index = 0; index < lines.length; index++) {
    if (pattern.test(lines[index])) {
      return index + 1;
    }
  }
  return 0;
}

export function extractPackageJsonDependencies(manifestPath: string): DependencyCoordinate[] {
  const absolute = path.resolve(manifestPath);
  if (!fs.existsSync(absolute)) {
    return [];
  }

  let source: string;
  let parsed: PackageJsonShape;
  try {
    source = fs.readFileSync(absolute, "utf8");
    parsed = JSON.parse(source) as PackageJsonShape;
  } catch {
    return [];
  }

  const merged = {
    ...parsed.dependencies,
    ...parsed.devDependencies,
    ...parsed.optionalDependencies,
    ...parsed.peerDependencies
  };

  const coordinates: DependencyCoordinate[] = [];
  for (const [name, versionRange] of Object.entries(merged)) {
    const version = normalizeExactVersion(versionRange);
    if (!version) {
      continue;
    }
    coordinates.push({
      ecosystem: NPM_ECOSYSTEM,
      name,
      version,
      manifestPath: absolute,
      manifestLine: findDependencyLine(source, name)
    });
  }

  return coordinates;
}

export function extractDependenciesForManifest(manifestPath: string): DependencyCoordinate[] {
  const baseName = path.basename(manifestPath).toLowerCase();
  if (baseName === "package.json") {
    return extractPackageJsonDependencies(manifestPath);
  }
  return [];
}
