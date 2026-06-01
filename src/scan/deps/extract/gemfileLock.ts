import { DependencyCoordinate } from "../types";
import {
  DependencyExtractionResult,
  MAX_LOCKFILE_BYTES,
  dedupeCoordinates,
  emptyExtractionResult,
  manifestReadWarning,
  readManifestSource
} from "./shared";
import { RUBYGEMS_ECOSYSTEM } from "./gemfile";

const GEM_LOCK_SPEC_RE = /^\s+([A-Za-z0-9_.-]+)\s+\(([^)]+)\)\s*$/;
const RESOLVED_VERSION_RE = /^[0-9][0-9A-Za-z.-]*$/;

function normalizeLockfileVersion(raw: string): string | null {
  let trimmed = raw.trim();
  if (trimmed.startsWith("= ")) {
    trimmed = trimmed.slice(2).trim();
  }
  if (!trimmed || /[~><|,]/.test(trimmed) || /\s/.test(trimmed)) {
    return null;
  }
  if (!RESOLVED_VERSION_RE.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function extractGemfileLockDependencies(manifestPath: string): DependencyExtractionResult {
  const readResult = readManifestSource(manifestPath, { maxBytes: MAX_LOCKFILE_BYTES });
  if (!readResult.source) {
    if (readResult.warning) {
      return emptyExtractionResult(manifestReadWarning(readResult.absolutePath, readResult.warning));
    }
    return emptyExtractionResult();
  }

  const dependencies: DependencyCoordinate[] = [];
  const lines = readResult.source.split(/\r?\n/);

  for (let index = 0; index < lines.length; index++) {
    const rawLine = lines[index] ?? "";
    const match = rawLine.match(GEM_LOCK_SPEC_RE);
    if (!match) {
      continue;
    }

    const name = match[1];
    const version = normalizeLockfileVersion(match[2] ?? "");
    if (!name || !version) {
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

  return {
    dependencies: dedupeCoordinates(dependencies),
    warnings: []
  };
}
