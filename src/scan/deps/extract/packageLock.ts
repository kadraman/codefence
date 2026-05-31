import { DependencyCoordinate } from "../types";
import {
  DependencyExtractionResult,
  MAX_LOCKFILE_BYTES,
  NPM_ECOSYSTEM,
  dedupeCoordinates,
  depsExtractionWarning,
  emptyExtractionResult,
  findBestEffortLine,
  manifestReadWarning,
  normalizeInstalledVersion,
  readManifestSource
} from "./shared";

interface PackageLockEntry {
  name?: unknown;
  version?: unknown;
  link?: unknown;
  dependencies?: Record<string, PackageLockEntry>;
}

interface PackageLockShape {
  lockfileVersion?: unknown;
  packages?: Record<string, PackageLockEntry>;
  dependencies?: Record<string, PackageLockEntry>;
}

function derivePackageNameFromPackagePath(packagePath: string): string | null {
  const normalized = packagePath.replace(/\\/g, "/").trim();
  if (!normalized) {
    return null;
  }

  const marker = "/node_modules/";
  if (normalized.includes(marker)) {
    const lastIndex = normalized.lastIndexOf(marker);
    const derived = normalized.slice(lastIndex + marker.length).trim();
    return derived ? derived : null;
  }

  if (normalized.startsWith("node_modules/")) {
    const derived = normalized.slice("node_modules/".length).trim();
    return derived ? derived : null;
  }

  return normalized;
}

function coordinatesFromPackages(
  source: string,
  manifestPath: string,
  packages: Record<string, PackageLockEntry>
): DependencyCoordinate[] {
  const dependencies: DependencyCoordinate[] = [];
  for (const [packagePath, entry] of Object.entries(packages)) {
    if (!packagePath || packagePath === "") {
      continue;
    }

    const name = typeof entry?.name === "string" ? entry.name.trim() : derivePackageNameFromPackagePath(packagePath);
    const version = typeof entry?.version === "string" ? normalizeInstalledVersion(entry.version) : null;
    if (!name || !version || entry?.link === true) {
      continue;
    }

    dependencies.push({
      ecosystem: NPM_ECOSYSTEM,
      name,
      version,
      manifestPath,
      manifestLine:
        findBestEffortLine(source, [packagePath, version]) ||
        findBestEffortLine(source, [name, version])
    });
  }
  return dependencies;
}

function collectLegacyDependencies(
  source: string,
  manifestPath: string,
  tree: Record<string, PackageLockEntry> | undefined,
  dependencies: DependencyCoordinate[]
): void {
  if (!tree) {
    return;
  }

  for (const [name, entry] of Object.entries(tree)) {
    const version = typeof entry?.version === "string" ? normalizeInstalledVersion(entry.version) : null;
    if (version && entry?.link !== true) {
      dependencies.push({
        ecosystem: NPM_ECOSYSTEM,
        name,
        version,
        manifestPath,
        manifestLine:
          findBestEffortLine(source, [`"${name}"`, `"${version}"`]) ||
          findBestEffortLine(source, [name, version])
      });
    }

    collectLegacyDependencies(source, manifestPath, entry?.dependencies, dependencies);
  }
}

export function extractPackageLockDependencies(manifestPath: string): DependencyExtractionResult {
  const readResult = readManifestSource(manifestPath, { maxBytes: MAX_LOCKFILE_BYTES });
  if (!readResult.source) {
    return emptyExtractionResult(
      readResult.warning ? manifestReadWarning(readResult.absolutePath, readResult.warning) : undefined
    );
  }

  let parsed: PackageLockShape;
  try {
    parsed = JSON.parse(readResult.source) as PackageLockShape;
  } catch {
    return emptyExtractionResult(
      depsExtractionWarning(
        readResult.absolutePath,
        "deps.malformed-lockfile",
        "Malformed package-lock.json; skipping dependency extraction."
      )
    );
  }

  if (parsed.lockfileVersion !== 2 && parsed.lockfileVersion !== 3) {
    return emptyExtractionResult(
      depsExtractionWarning(
        readResult.absolutePath,
        "deps.unsupported-lockfile",
        `Unsupported package-lock.json lockfileVersion ${String(parsed.lockfileVersion ?? "unknown")}; only v2/v3 are supported.`
      )
    );
  }

  const dependencies: DependencyCoordinate[] =
    parsed.packages && typeof parsed.packages === "object"
      ? coordinatesFromPackages(readResult.source, readResult.absolutePath, parsed.packages)
      : [];

  if (dependencies.length === 0) {
    collectLegacyDependencies(readResult.source, readResult.absolutePath, parsed.dependencies, dependencies);
  }

  return {
    dependencies: dedupeCoordinates(dependencies),
    warnings: []
  };
}
