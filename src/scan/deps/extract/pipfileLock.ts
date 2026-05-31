import path from "node:path";
import { DependencyCoordinate } from "../types";
import {
  DependencyExtractionResult,
  MAX_LOCKFILE_BYTES,
  dedupeCoordinates,
  depsExtractionWarning,
  emptyExtractionResult,
  findBestEffortLine,
  manifestReadWarning,
  normalizeExactVersion,
  readManifestSource
} from "./shared";
import { PYPI_ECOSYSTEM } from "./requirementsTxt";

const LOCK_SECTIONS = new Set(["default", "develop", "development"]);

interface PipfileLockPackageEntry {
  version?: unknown;
  git?: unknown;
  ref?: unknown;
  editable?: unknown;
  path?: unknown;
  file?: unknown;
}

interface PipfileLockLegacyEntry {
  name?: unknown;
  version?: unknown;
  git?: unknown;
  ref?: unknown;
  editable?: unknown;
  path?: unknown;
  file?: unknown;
}

type PipfileLockSection = Record<string, PipfileLockPackageEntry> | PipfileLockLegacyEntry[];

function normalizePipfileLockVersion(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }

  const trimmed = raw.trim();
  const exactMatch = trimmed.match(/^==\s*([A-Za-z0-9][0-9A-Za-z._+-]*)$/);
  const candidate = exactMatch?.[1] ?? trimmed;
  return normalizeExactVersion(candidate);
}

function isVcsOrPathEntry(entry: PipfileLockPackageEntry | PipfileLockLegacyEntry): boolean {
  return (
    typeof entry.git === "string" ||
    typeof entry.path === "string" ||
    typeof entry.file === "string" ||
    (typeof entry.ref === "string" && typeof entry.version !== "string")
  );
}

function pushCoordinate(
  dependencies: DependencyCoordinate[],
  source: string,
  manifestPath: string,
  name: string,
  version: string
): void {
  dependencies.push({
    ecosystem: PYPI_ECOSYSTEM,
    name,
    version,
    manifestPath,
    manifestLine: findBestEffortLine(source, [name, version]) || findBestEffortLine(source, [name])
  });
}

function extractFromObjectSection(
  source: string,
  manifestPath: string,
  section: Record<string, PipfileLockPackageEntry>,
  dependencies: DependencyCoordinate[]
): void {
  for (const [name, entry] of Object.entries(section)) {
    if (!entry || typeof entry !== "object" || isVcsOrPathEntry(entry)) {
      continue;
    }

    const version = normalizePipfileLockVersion(entry.version);
    if (!version) {
      continue;
    }

    pushCoordinate(dependencies, source, manifestPath, name, version);
  }
}

function extractFromArraySection(
  source: string,
  manifestPath: string,
  section: PipfileLockLegacyEntry[],
  dependencies: DependencyCoordinate[]
): void {
  for (const entry of section) {
    if (!entry || typeof entry !== "object" || isVcsOrPathEntry(entry)) {
      continue;
    }

    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    const version = normalizePipfileLockVersion(entry.version);
    if (!name || !version) {
      continue;
    }

    pushCoordinate(dependencies, source, manifestPath, name, version);
  }
}

function isPackageSection(value: unknown): value is Record<string, PipfileLockPackageEntry> | PipfileLockLegacyEntry[] {
  if (Array.isArray(value)) {
    return value.every((entry) => entry === null || typeof entry === "object");
  }

  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function extractPipfileLockDependencies(manifestPath: string): DependencyExtractionResult {
  const readResult = readManifestSource(manifestPath, { maxBytes: MAX_LOCKFILE_BYTES });
  if (!readResult.source) {
    return emptyExtractionResult(
      readResult.warning ? manifestReadWarning(readResult.absolutePath, readResult.warning) : undefined
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(readResult.source) as Record<string, unknown>;
  } catch {
    return emptyExtractionResult(
      depsExtractionWarning(
        readResult.absolutePath,
        "deps.malformed-lockfile",
        "Malformed Pipfile.lock; skipping dependency extraction."
      )
    );
  }

  const dependencies: DependencyCoordinate[] = [];
  for (const [sectionName, sectionValue] of Object.entries(parsed)) {
    if (sectionName === "_meta" || !isPackageSection(sectionValue)) {
      continue;
    }

    if (Array.isArray(sectionValue)) {
      if (LOCK_SECTIONS.has(sectionName)) {
        extractFromArraySection(readResult.source, readResult.absolutePath, sectionValue, dependencies);
      }
      continue;
    }

    extractFromObjectSection(readResult.source, readResult.absolutePath, sectionValue, dependencies);
  }

  if (dependencies.length === 0 && Object.keys(parsed).some((key) => key !== "_meta")) {
    return emptyExtractionResult(
      depsExtractionWarning(
        readResult.absolutePath,
        "deps.empty-lockfile",
        `No PyPI package versions extracted from ${path.basename(readResult.absolutePath)}.`
      )
    );
  }

  return {
    dependencies: dedupeCoordinates(dependencies),
    warnings: []
  };
}
