import path from "node:path";
import { DependencyCoordinate } from "./types";
import { extractPackageLockDependencies } from "./extract/packageLock";
import { extractPipfileDependencies } from "./extract/pipfile";
import { extractPipfileLockDependencies } from "./extract/pipfileLock";
import { extractPoetryLockDependencies } from "./extract/poetryLock";
import { extractPnpmLockDependencies } from "./extract/pnpmLock";
import { extractPyprojectTomlDependencies } from "./extract/pyprojectToml";
import { extractRequirementsTxtDependencies } from "./extract/requirementsTxt";
import { extractUvLockDependencies } from "./extract/uvLock";
import {
  DependencyExtractionResult,
  NPM_ECOSYSTEM,
  findPackageJsonDependencyLine,
  normalizeExactVersion,
  readManifestSource
} from "./extract/shared";
import { extractYarnLockDependencies } from "./extract/yarnLock";

interface PackageJsonShape {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export { normalizeExactVersion } from "./extract/shared";

export function extractPackageJsonDependencies(manifestPath: string): DependencyCoordinate[] {
  const readResult = readManifestSource(manifestPath);
  if (!readResult.source) {
    return [];
  }

  let parsed: PackageJsonShape;
  try {
    parsed = JSON.parse(readResult.source) as PackageJsonShape;
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
      manifestPath: readResult.absolutePath,
      manifestLine: findPackageJsonDependencyLine(readResult.source, name)
    });
  }

  return coordinates;
}

export function extractDependenciesForManifestWithDiagnostics(
  manifestPath: string
): DependencyExtractionResult {
  const baseName = path.basename(manifestPath).toLowerCase();
  if (baseName === "package.json") {
    return {
      dependencies: extractPackageJsonDependencies(manifestPath),
      warnings: []
    };
  }
  if (baseName === "package-lock.json") {
    return extractPackageLockDependencies(manifestPath);
  }
  if (baseName === "yarn.lock") {
    return extractYarnLockDependencies(manifestPath);
  }
  if (baseName === "pnpm-lock.yaml") {
    return extractPnpmLockDependencies(manifestPath);
  }
  if (baseName === "requirements.txt") {
    return extractRequirementsTxtDependencies(manifestPath);
  }
  if (baseName === "pipfile") {
    return extractPipfileDependencies(manifestPath);
  }
  if (baseName === "pipfile.lock") {
    return extractPipfileLockDependencies(manifestPath);
  }
  if (baseName === "poetry.lock") {
    return extractPoetryLockDependencies(manifestPath);
  }
  if (baseName === "uv.lock") {
    return extractUvLockDependencies(manifestPath);
  }
  if (baseName === "pyproject.toml") {
    return extractPyprojectTomlDependencies(manifestPath);
  }
  return { dependencies: [], warnings: [] };
}

export function extractDependenciesForManifest(manifestPath: string): DependencyCoordinate[] {
  return extractDependenciesForManifestWithDiagnostics(manifestPath).dependencies;
}
