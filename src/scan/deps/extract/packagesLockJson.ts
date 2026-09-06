import { DependencyCoordinate } from "../types";
import {
  DependencyExtractionResult,
  MAX_LOCKFILE_BYTES,
  dedupeCoordinates,
  emptyExtractionResult,
  manifestReadWarning,
  readManifestSource
} from "./shared";
import { NUGET_ECOSYSTEM } from "./csproj";

interface PackagesLockPackage {
  type?: string;
  resolved?: string;
  requested?: string;
}

interface PackagesLockShape {
  version?: number;
  dependencies?: Record<string, Record<string, PackagesLockPackage>>;
}

function normalizeNuGetLockVersion(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || /[[\]*,]/.test(trimmed) || /^[~^>=<]/.test(trimmed)) {
    return null;
  }
  if (!/^\d+\.\d+/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function findPackagesLockLine(source: string, packageName: string): number {
  const lines = source.split(/\r?\n/);
  const pattern = new RegExp(`"${packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s*:`);
  for (let index = 0; index < lines.length; index++) {
    if (pattern.test(lines[index] ?? "")) {
      return index + 1;
    }
  }
  return 0;
}

export function extractPackagesLockJsonDependencies(manifestPath: string): DependencyExtractionResult {
  const readResult = readManifestSource(manifestPath, { maxBytes: MAX_LOCKFILE_BYTES });
  if (!readResult.source) {
    if (readResult.warning) {
      return emptyExtractionResult(manifestReadWarning(readResult.absolutePath, readResult.warning));
    }
    return emptyExtractionResult();
  }

  let parsed: PackagesLockShape;
  try {
    parsed = JSON.parse(readResult.source) as PackagesLockShape;
  } catch {
    return emptyExtractionResult(
      manifestReadWarning(readResult.absolutePath, "Unable to parse packages.lock.json as JSON.")
    );
  }

  const dependencies: DependencyCoordinate[] = [];
  const frameworks = parsed.dependencies;
  if (!frameworks || typeof frameworks !== "object") {
    return { dependencies: [], warnings: [] };
  }

  for (const frameworkPackages of Object.values(frameworks)) {
    if (!frameworkPackages || typeof frameworkPackages !== "object") {
      continue;
    }

    for (const [name, entry] of Object.entries(frameworkPackages)) {
      if (!name.trim() || !entry || typeof entry !== "object") {
        continue;
      }

      // Project references are not NuGet packages.
      if ((entry.type ?? "").toLowerCase() === "project") {
        continue;
      }

      const version = normalizeNuGetLockVersion(entry.resolved ?? "");
      if (!version) {
        continue;
      }

      dependencies.push({
        ecosystem: NUGET_ECOSYSTEM,
        name,
        version,
        manifestPath: readResult.absolutePath,
        manifestLine: findPackagesLockLine(readResult.source, name)
      });
    }
  }

  return {
    dependencies: dedupeCoordinates(dependencies),
    warnings: []
  };
}
