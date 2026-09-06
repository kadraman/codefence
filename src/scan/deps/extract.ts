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
import { extractCargoLockDependencies } from "./extract/cargoLock";
import { extractCargoTomlDependencies } from "./extract/cargoToml";
import { extractComposerJsonDependencies } from "./extract/composerJson";
import { extractComposerLockDependencies } from "./extract/composerLock";
import { extractGemfileDependencies } from "./extract/gemfile";
import { extractGemfileLockDependencies } from "./extract/gemfileLock";
import { extractCsprojDependencies } from "./extract/csproj";
import { extractGoModDependencies } from "./extract/goMod";
import { extractGradleDependencies } from "./extract/gradle";
import { extractPackagesConfigDependencies } from "./extract/packagesConfig";
import { extractPackagesLockJsonDependencies } from "./extract/packagesLockJson";
import { extractPackageResolvedDependencies } from "./extract/packageResolved";
import { extractPackageSwiftDependencies } from "./extract/packageSwift";
import { extractPomXmlDependencies } from "./extract/pomXml";
import { extractSlnDependencies } from "./extract/sln";
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

type ManifestExtractor = (manifestPath: string) => DependencyExtractionResult;

/** Exact basename → extractor (lowercase). Extension-based manifests are handled separately. */
const BASENAME_EXTRACTORS: Record<string, ManifestExtractor> = {
  "package.json": (manifestPath) => ({
    dependencies: extractPackageJsonDependencies(manifestPath),
    warnings: []
  }),
  "package-lock.json": extractPackageLockDependencies,
  "yarn.lock": extractYarnLockDependencies,
  "pnpm-lock.yaml": extractPnpmLockDependencies,
  "requirements.txt": extractRequirementsTxtDependencies,
  pipfile: extractPipfileDependencies,
  "pipfile.lock": extractPipfileLockDependencies,
  "poetry.lock": extractPoetryLockDependencies,
  "uv.lock": extractUvLockDependencies,
  "pyproject.toml": extractPyprojectTomlDependencies,
  "go.mod": extractGoModDependencies,
  gemfile: extractGemfileDependencies,
  "gemfile.lock": extractGemfileLockDependencies,
  "composer.json": extractComposerJsonDependencies,
  "composer.lock": extractComposerLockDependencies,
  "cargo.toml": extractCargoTomlDependencies,
  "cargo.lock": extractCargoLockDependencies,
  "pom.xml": extractPomXmlDependencies,
  "build.gradle": extractGradleDependencies,
  "build.gradle.kts": extractGradleDependencies,
  "packages.config": extractPackagesConfigDependencies,
  "packages.lock.json": extractPackagesLockJsonDependencies,
  "package.swift": extractPackageSwiftDependencies,
  "package.resolved": extractPackageResolvedDependencies
};

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
  const byBasename = BASENAME_EXTRACTORS[baseName];
  if (byBasename) {
    return byBasename(manifestPath);
  }
  if (baseName.endsWith(".csproj")) {
    return extractCsprojDependencies(manifestPath);
  }
  if (baseName.endsWith(".sln")) {
    return extractSlnDependencies(manifestPath);
  }
  return { dependencies: [], warnings: [] };
}

export function extractDependenciesForManifest(manifestPath: string): DependencyCoordinate[] {
  return extractDependenciesForManifestWithDiagnostics(manifestPath).dependencies;
}
