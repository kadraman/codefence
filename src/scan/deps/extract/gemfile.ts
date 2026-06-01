import { DependencyCoordinate } from "../types";
import {
  DependencyExtractionResult,
  dedupeCoordinates,
  manifestReadWarning,
  nonExactSpecWarning,
  readManifestSource
} from "./shared";

export const RUBYGEMS_ECOSYSTEM = "RubyGems";

const GEM_WITH_VERSION_RE = /^\s*gem\s+['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*$/;

function normalizeGemfileVersion(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || /[~^*<>=|]/.test(trimmed)) {
    return null;
  }
  if (!/^[0-9][0-9A-Za-z.-]*$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function extractGemfileDependencies(manifestPath: string): DependencyExtractionResult {
  const readResult = readManifestSource(manifestPath);
  if (!readResult.source) {
    return {
      dependencies: [],
      warnings: readResult.warning ? [manifestReadWarning(readResult.absolutePath, readResult.warning)] : []
    };
  }

  const dependencies: DependencyCoordinate[] = [];
  let skippedNonExact = false;
  const lines = readResult.source.split(/\r?\n/);

  for (let index = 0; index < lines.length; index++) {
    const rawLine = lines[index] ?? "";
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = rawLine.match(GEM_WITH_VERSION_RE);
    if (!match) {
      continue;
    }

    const name = match[1];
    const version = normalizeGemfileVersion(match[2] ?? "");
    if (!name) {
      continue;
    }
    if (!version) {
      skippedNonExact = true;
      continue;
    }

    dependencies.push({
      ecosystem: RUBYGEMS_ECOSYSTEM,
      name,
      version,
      manifestPath: readResult.absolutePath,
      manifestLine: index + 1
    });
  }

  const warnings = skippedNonExact ? [nonExactSpecWarning(readResult.absolutePath, "Gemfile")] : [];
  return {
    dependencies: dedupeCoordinates(dependencies),
    warnings
  };
}
