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

export function extractPackageJsonDependencies(manifestPath: string): DependencyCoordinate[] {
  const absolute = path.resolve(manifestPath);
  if (!fs.existsSync(absolute)) {
    return [];
  }

  let parsed: PackageJsonShape;
  try {
    parsed = JSON.parse(fs.readFileSync(absolute, "utf8")) as PackageJsonShape;
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
      manifestPath: absolute
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

