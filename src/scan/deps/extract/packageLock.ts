import { DependencyCoordinate } from "../types";
import {
  DependencyExtractionResult,
  MAX_LOCKFILE_BYTES,
  NPM_ECOSYSTEM,
  dedupeCoordinates,
  emptyExtractionResult,
  findBestEffortLine,
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
  const normalized = packagePath.replace(/\\/g, "/");
  const parts = normalized.split("/node_modules/");
  const last = parts[parts.length - 1]?.trim();
  return last ? last : null;
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
    return emptyExtractionResult(readResult.warning);
  }

  let parsed: PackageLockShape;
  try {
    parsed = JSON.parse(readResult.source) as PackageLockShape;
  } catch {
    return emptyExtractionResult("Malformed package-lock.json; skipping dependency extraction.");
  }

  if (parsed.lockfileVersion !== 2 && parsed.lockfileVersion !== 3) {
    return emptyExtractionResult(
      `Unsupported package-lock.json lockfileVersion ${String(parsed.lockfileVersion ?? "unknown")}; only v2/v3 are supported.`
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
