import { parse } from "yaml";
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

interface ImporterDependencyEntry {
  version?: unknown;
}

interface PnpmImporterShape {
  dependencies?: Record<string, string | ImporterDependencyEntry>;
  devDependencies?: Record<string, string | ImporterDependencyEntry>;
  optionalDependencies?: Record<string, string | ImporterDependencyEntry>;
}

interface PnpmLockShape {
  packages?: Record<string, unknown>;
  importers?: Record<string, PnpmImporterShape>;
}

function parsePackageKey(key: string): { name: string; version: string } | null {
  const normalized = key.trim().replace(/^\/+/, "").replace(/\([^)]*\)$/g, "");
  if (!normalized || normalized.startsWith("file:") || normalized.startsWith("link:")) {
    return null;
  }

  let name: string;
  let versionText: string;
  if (normalized.startsWith("@")) {
    const scopeSlash = normalized.indexOf("/");
    const versionAt = normalized.indexOf("@", scopeSlash + 1);
    if (scopeSlash === -1 || versionAt === -1) {
      return null;
    }
    name = normalized.slice(0, versionAt);
    versionText = normalized.slice(versionAt + 1);
  } else {
    const versionAt = normalized.lastIndexOf("@");
    if (versionAt <= 0) {
      return null;
    }
    name = normalized.slice(0, versionAt);
    versionText = normalized.slice(versionAt + 1);
  }

  const version = normalizeInstalledVersion(versionText);
  if (!version) {
    return null;
  }

  return { name, version };
}

function importerVersion(entry: string | ImporterDependencyEntry): string | null {
  if (typeof entry === "string") {
    return normalizeInstalledVersion(entry);
  }
  if (!entry || typeof entry !== "object" || typeof entry.version !== "string") {
    return null;
  }
  return normalizeInstalledVersion(entry.version);
}

export function extractPnpmLockDependencies(manifestPath: string): DependencyExtractionResult {
  const readResult = readManifestSource(manifestPath, { maxBytes: MAX_LOCKFILE_BYTES });
  if (!readResult.source) {
    return emptyExtractionResult(
      readResult.warning ? manifestReadWarning(readResult.absolutePath, readResult.warning) : undefined
    );
  }

  let parsed: PnpmLockShape;
  try {
    parsed = parse(readResult.source) as PnpmLockShape;
  } catch {
    return emptyExtractionResult(
      depsExtractionWarning(
        readResult.absolutePath,
        "deps.malformed-lockfile",
        "Malformed pnpm-lock.yaml; skipping dependency extraction."
      )
    );
  }

  const dependencies: DependencyCoordinate[] = [];
  if (parsed.packages && typeof parsed.packages === "object") {
    for (const key of Object.keys(parsed.packages)) {
      const resolved = parsePackageKey(key);
      if (!resolved) {
        continue;
      }
      dependencies.push({
        ecosystem: NPM_ECOSYSTEM,
        name: resolved.name,
        version: resolved.version,
        manifestPath: readResult.absolutePath,
        manifestLine:
          findBestEffortLine(readResult.source, [key, resolved.version]) ||
          findBestEffortLine(readResult.source, [resolved.name, resolved.version])
      });
    }
  }

  if (dependencies.length === 0 && parsed.importers && typeof parsed.importers === "object") {
    for (const importer of Object.values(parsed.importers)) {
      if (!importer || typeof importer !== "object") {
        continue;
      }
      for (const section of ["dependencies", "devDependencies", "optionalDependencies"] as const) {
        const entries = importer[section];
        if (!entries || typeof entries !== "object") {
          continue;
        }
        for (const [name, entry] of Object.entries(entries)) {
          const version = importerVersion(entry);
          if (!version) {
            continue;
          }
          dependencies.push({
            ecosystem: NPM_ECOSYSTEM,
            name,
            version,
            manifestPath: readResult.absolutePath,
            manifestLine: findBestEffortLine(readResult.source, [name, version])
          });
        }
      }
    }
  }

  return {
    dependencies: dedupeCoordinates(dependencies),
    warnings: []
  };
}
