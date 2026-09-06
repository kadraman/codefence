import { DependencyCoordinate } from "../types";
import {
  DependencyExtractionResult,
  MAX_LOCKFILE_BYTES,
  dedupeCoordinates,
  emptyExtractionResult,
  manifestReadWarning,
  readManifestSource
} from "./shared";
import { PACKAGIST_ECOSYSTEM } from "./composerJson";

interface ComposerLockPackage {
  name?: string;
  version?: string;
}

interface ComposerLockShape {
  packages?: ComposerLockPackage[];
  "packages-dev"?: ComposerLockPackage[];
}

function isComposerPlatformPackage(name: string): boolean {
  const trimmed = name.trim().toLowerCase();
  return trimmed === "php" || trimmed.startsWith("ext-") || trimmed.startsWith("lib-");
}

function normalizeComposerLockVersion(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes("dev-") || /[*^~><|]/.test(trimmed)) {
    return null;
  }
  const normalized = trimmed.replace(/^v/i, "");
  if (!/^\d+\.\d+/.test(normalized)) {
    return null;
  }
  return normalized;
}

function findComposerLockPackageLine(source: string, packageName: string): number {
  const lines = source.split(/\r?\n/);
  const pattern = new RegExp(`"name"\\s*:\\s*"${packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`);
  for (let index = 0; index < lines.length; index++) {
    if (pattern.test(lines[index] ?? "")) {
      return index + 1;
    }
  }
  return 0;
}

export function extractComposerLockDependencies(manifestPath: string): DependencyExtractionResult {
  const readResult = readManifestSource(manifestPath, { maxBytes: MAX_LOCKFILE_BYTES });
  if (!readResult.source) {
    if (readResult.warning) {
      return emptyExtractionResult(manifestReadWarning(readResult.absolutePath, readResult.warning));
    }
    return emptyExtractionResult();
  }

  let parsed: ComposerLockShape;
  try {
    parsed = JSON.parse(readResult.source) as ComposerLockShape;
  } catch {
    return emptyExtractionResult(
      manifestReadWarning(readResult.absolutePath, "Unable to parse composer.lock as JSON.")
    );
  }

  const dependencies: DependencyCoordinate[] = [];
  const sections = [parsed.packages, parsed["packages-dev"]];

  for (const section of sections) {
    if (!Array.isArray(section)) {
      continue;
    }

    for (const entry of section) {
      const name = entry.name?.trim();
      const versionRaw = entry.version?.trim();
      if (!name || !versionRaw || isComposerPlatformPackage(name)) {
        continue;
      }

      const version = normalizeComposerLockVersion(versionRaw);
      if (!version) {
        continue;
      }

      dependencies.push({
        ecosystem: PACKAGIST_ECOSYSTEM,
        name,
        version,
        manifestPath: readResult.absolutePath,
        manifestLine: findComposerLockPackageLine(readResult.source, name)
      });
    }
  }

  return {
    dependencies: dedupeCoordinates(dependencies),
    warnings: []
  };
}
