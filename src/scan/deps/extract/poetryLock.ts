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

const NON_PYPI_SOURCE_TYPES = new Set(["git", "directory", "path", "file", "url"]);

function parseTomlStringValue(raw: string): string {
  const trimmed = raw.trim();
  const quotedMatch = trimmed.match(/^["'](.+)["']$/);
  return (quotedMatch?.[1] ?? trimmed).trim();
}

function parseKeyValue(line: string): { key: string; value: string } | null {
  const match = line.match(/^([A-Za-z0-9._-]+)\s*=\s*(.+)$/);
  if (!match) {
    return null;
  }

  return {
    key: match[1],
    value: parseTomlStringValue(match[2] ?? "")
  };
}

interface PoetryPackageBlock {
  name: string | null;
  version: string | null;
  sourceType: string | null;
}

function shouldSkipPackage(block: PoetryPackageBlock): boolean {
  if (!block.name || !block.version) {
    return true;
  }

  if (block.sourceType && NON_PYPI_SOURCE_TYPES.has(block.sourceType.toLowerCase())) {
    return true;
  }

  return normalizeExactVersion(block.version) === null;
}

function flushPackageBlock(
  source: string,
  manifestPath: string,
  block: PoetryPackageBlock,
  dependencies: DependencyCoordinate[]
): void {
  if (shouldSkipPackage(block)) {
    return;
  }

  const version = normalizeExactVersion(block.version ?? "") ?? block.version ?? "";
  dependencies.push({
    ecosystem: PYPI_ECOSYSTEM,
    name: block.name ?? "",
    version,
    manifestPath,
    manifestLine:
      findBestEffortLine(source, [`name = "${block.name}"`, `version = "${version}"`]) ||
      findBestEffortLine(source, [block.name ?? "", version])
  });
}

export function extractPoetryLockDependencies(manifestPath: string): DependencyExtractionResult {
  const readResult = readManifestSource(manifestPath, { maxBytes: MAX_LOCKFILE_BYTES });
  if (!readResult.source) {
    return emptyExtractionResult(
      readResult.warning ? manifestReadWarning(readResult.absolutePath, readResult.warning) : undefined
    );
  }

  const dependencies: DependencyCoordinate[] = [];
  let block: PoetryPackageBlock = { name: null, version: null, sourceType: null };
  let inSourceSection = false;

  for (const rawLine of readResult.source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    if (line === "[[package]]") {
      flushPackageBlock(readResult.source, readResult.absolutePath, block, dependencies);
      block = { name: null, version: null, sourceType: null };
      inSourceSection = false;
      continue;
    }

    if (line === "[package.source]") {
      inSourceSection = true;
      continue;
    }

    if (line.startsWith("[") && line.endsWith("]")) {
      inSourceSection = false;
      continue;
    }

    const parsed = parseKeyValue(line);
    if (!parsed) {
      continue;
    }

    if (inSourceSection) {
      if (parsed.key === "type") {
        block.sourceType = parsed.value;
      }
      continue;
    }

    if (parsed.key === "name") {
      block.name = parsed.value;
    } else if (parsed.key === "version") {
      block.version = parsed.value;
    }
  }

  flushPackageBlock(readResult.source, readResult.absolutePath, block, dependencies);

  if (dependencies.length === 0) {
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
