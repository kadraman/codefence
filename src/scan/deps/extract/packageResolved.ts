import {
  DependencyExtractionResult,
  MAX_LOCKFILE_BYTES,
  dedupeCoordinates,
  emptyExtractionResult,
  manifestReadWarning,
  readManifestSource
} from "./shared";
import { normalizeSwiftUrlPackageName, SWIFT_URL_ECOSYSTEM } from "./packageSwift";
import { DependencyCoordinate } from "../types";

interface ResolvedPin {
  identity?: string;
  package?: string;
  location?: string;
  repositoryURL?: string;
  state?: {
    version?: string | null;
    revision?: string | null;
    branch?: string | null;
  };
}

interface PackageResolvedV2 {
  pins?: ResolvedPin[];
  version?: number;
}

interface PackageResolvedV1 {
  object?: {
    pins?: ResolvedPin[];
  };
  version?: number;
}

function normalizeResolvedVersion(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim().replace(/^v/i, "");
  if (!/^\d+\.\d+/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function pinLocation(pin: ResolvedPin): string | null {
  return pin.location?.trim() || pin.repositoryURL?.trim() || null;
}

function pinName(pin: ResolvedPin): string | null {
  const fromLocation = normalizeSwiftUrlPackageName(pinLocation(pin) ?? "");
  if (fromLocation) {
    return fromLocation;
  }
  const identity = (pin.identity ?? pin.package ?? "").trim();
  return identity ? identity.toLowerCase() : null;
}

function findVersionLine(source: string, packageName: string, version: string): number {
  const lines = source.split(/\r?\n/);
  const needle = `"version" : "${version}"`;
  const altNeedle = `"version": "${version}"`;
  // Prefer a line near a matching location/identity when possible.
  let fallback = 0;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    if (line.includes(needle) || line.includes(altNeedle)) {
      if (fallback === 0) {
        fallback = index + 1;
      }
      const window = lines.slice(Math.max(0, index - 8), index + 1).join("\n").toLowerCase();
      if (window.includes(packageName.toLowerCase())) {
        return index + 1;
      }
    }
  }
  return fallback;
}

export function extractPackageResolvedDependencies(manifestPath: string): DependencyExtractionResult {
  const readResult = readManifestSource(manifestPath, { maxBytes: MAX_LOCKFILE_BYTES });
  if (!readResult.source) {
    if (readResult.warning) {
      return emptyExtractionResult(manifestReadWarning(readResult.absolutePath, readResult.warning));
    }
    return emptyExtractionResult();
  }

  let parsed: PackageResolvedV2 & PackageResolvedV1;
  try {
    parsed = JSON.parse(readResult.source) as PackageResolvedV2 & PackageResolvedV1;
  } catch {
    return emptyExtractionResult(
      manifestReadWarning(readResult.absolutePath, "Unable to parse Package.resolved as JSON.")
    );
  }

  const pins = parsed.pins ?? parsed.object?.pins ?? [];
  const dependencies: DependencyCoordinate[] = [];

  for (const pin of pins) {
    const name = pinName(pin);
    const version = normalizeResolvedVersion(pin.state?.version);
    if (!name || !version) {
      continue;
    }

    dependencies.push({
      ecosystem: SWIFT_URL_ECOSYSTEM,
      name,
      version,
      manifestPath: readResult.absolutePath,
      manifestLine: findVersionLine(readResult.source, name, version)
    });
  }

  return {
    dependencies: dedupeCoordinates(dependencies),
    warnings: []
  };
}
