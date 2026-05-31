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

const PACKAGE_BLOCK_HEADERS = new Set(["[[package]]", "[[distribution]]"]);

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

function isNonRegistrySource(sourceValue: string | null): boolean {
  if (!sourceValue) {
    return false;
  }

  const lower = sourceValue.toLowerCase();
  if (lower.includes("registry") || lower.includes("pypi.org")) {
    return false;
  }

  return (
    lower.includes("git") ||
    lower.includes("path") ||
    lower.includes("editable") ||
    lower.includes("directory") ||
    lower.startsWith("url")
  );
}

interface UvPackageBlock {
  name: string | null;
  version: string | null;
  source: string | null;
}

function shouldSkipPackage(block: UvPackageBlock): boolean {
  if (!block.name || !block.version) {
    return true;
  }

  if (isNonRegistrySource(block.source)) {
    return true;
  }

  return normalizeExactVersion(block.version) === null;
}

function flushPackageBlock(
  source: string,
  manifestPath: string,
  block: UvPackageBlock,
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

export function extractUvLockDependencies(manifestPath: string): DependencyExtractionResult {
  const readResult = readManifestSource(manifestPath, { maxBytes: MAX_LOCKFILE_BYTES });
  if (!readResult.source) {
    return emptyExtractionResult(
      readResult.warning ? manifestReadWarning(readResult.absolutePath, readResult.warning) : undefined
    );
  }

  const dependencies: DependencyCoordinate[] = [];
  let block: UvPackageBlock = { name: null, version: null, source: null };

  for (const rawLine of readResult.source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    if (PACKAGE_BLOCK_HEADERS.has(line)) {
      flushPackageBlock(readResult.source, readResult.absolutePath, block, dependencies);
      block = { name: null, version: null, source: null };
      continue;
    }

    const parsed = parseKeyValue(line);
    if (!parsed) {
      continue;
    }

    if (parsed.key === "name") {
      block.name = parsed.value;
    } else if (parsed.key === "version") {
      block.version = parsed.value;
    } else if (parsed.key === "source") {
      block.source = parsed.value;
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
