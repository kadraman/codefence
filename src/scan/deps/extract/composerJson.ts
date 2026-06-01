import { DependencyCoordinate } from "../types";
import {
  DependencyExtractionResult,
  dedupeCoordinates,
  manifestReadWarning,
  nonExactSpecWarning,
  readManifestSource
} from "./shared";

export const PACKAGIST_ECOSYSTEM = "Packagist";

interface ComposerJsonShape {
  require?: Record<string, string>;
  "require-dev"?: Record<string, string>;
}

function isComposerPlatformPackage(name: string): boolean {
  const trimmed = name.trim().toLowerCase();
  return trimmed === "php" || trimmed.startsWith("ext-") || trimmed.startsWith("lib-");
}

function normalizeComposerVersion(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || /[*^~>=|@]/.test(trimmed) || trimmed.includes("dev-")) {
    return null;
  }
  const normalized = trimmed.replace(/^v/, "");
  if (!/^\d+\.\d+/.test(normalized)) {
    return null;
  }
  return normalized;
}

export function extractComposerJsonDependencies(manifestPath: string): DependencyExtractionResult {
  const readResult = readManifestSource(manifestPath);
  if (!readResult.source) {
    return {
      dependencies: [],
      warnings: readResult.warning ? [manifestReadWarning(readResult.absolutePath, readResult.warning)] : []
    };
  }

  let parsed: ComposerJsonShape;
  try {
    parsed = JSON.parse(readResult.source) as ComposerJsonShape;
  } catch {
    return {
      dependencies: [],
      warnings: [manifestReadWarning(readResult.absolutePath, "Unable to parse composer.json as JSON.")]
    };
  }

  const dependencies: DependencyCoordinate[] = [];
  let skippedNonExact = false;
  const sections = [parsed.require, parsed["require-dev"]];

  for (const section of sections) {
    if (!section) {
      continue;
    }

    for (const [name, versionRange] of Object.entries(section)) {
      if (isComposerPlatformPackage(name)) {
        continue;
      }

      const version = normalizeComposerVersion(versionRange);
      if (!version) {
        skippedNonExact = true;
        continue;
      }

      dependencies.push({
        ecosystem: PACKAGIST_ECOSYSTEM,
        name,
        version,
        manifestPath: readResult.absolutePath,
        manifestLine: findComposerPackageLine(readResult.source, name)
      });
    }
  }

  const warnings = skippedNonExact
    ? [nonExactSpecWarning(readResult.absolutePath, "composer.json")]
    : [];

  return {
    dependencies: dedupeCoordinates(dependencies),
    warnings
  };
}

function findComposerPackageLine(source: string, packageName: string): number {
  const lines = source.split(/\r?\n/);
  const pattern = new RegExp(`"${packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s*:`);
  for (let index = 0; index < lines.length; index++) {
    if (pattern.test(lines[index] ?? "")) {
      return index + 1;
    }
  }
  return 0;
}
