import path from "node:path";
import { DependencyCoordinate } from "../types";
import { DependencyExtractionResult, dedupeCoordinates, readManifestSource } from "./shared";
import { PYPI_ECOSYSTEM } from "./requirementsTxt";

const PIPFILE_HINT = "Skipped non-exact Pipfile dependency specs; pin versions with == to enable OSV lookups.";
const PACKAGE_SECTIONS = new Set(["packages", "dev-packages"]);

function normalizePipfileVersion(raw: string): string | null {
  const trimmed = raw.trim();
  const quotedMatch = trimmed.match(/^["'](.+)["']$/);
  const value = (quotedMatch?.[1] ?? trimmed).trim();
  const exactMatch = value.match(/^==\s*([A-Za-z0-9][0-9A-Za-z._+-]*)$/);
  return exactMatch?.[1] ?? null;
}

function parsePipfileVersionValue(rawValue: string): string | null {
  const inlineTableVersion = rawValue.match(/version\s*=\s*["']([^"']+)["']/i)?.[1];
  if (inlineTableVersion) {
    return normalizePipfileVersion(inlineTableVersion);
  }
  return normalizePipfileVersion(rawValue);
}

export function extractPipfileDependencies(manifestPath: string): DependencyExtractionResult {
  const readResult = readManifestSource(manifestPath);
  if (!readResult.source) {
    return { dependencies: [], warnings: readResult.warning ? [readResult.warning] : [] };
  }

  const dependencies: DependencyCoordinate[] = [];
  let skippedNonExact = false;
  let section = "";
  const lines = readResult.source.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const rawLine = lines[index] ?? "";
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1].trim().toLowerCase();
      continue;
    }

    if (!PACKAGE_SECTIONS.has(section)) {
      continue;
    }

    const assignment = rawLine.match(/^\s*["']?([A-Za-z0-9._-]+)["']?\s*=\s*(.+)\s*$/);
    if (!assignment) {
      continue;
    }

    const name = assignment[1];
    const version = parsePipfileVersionValue(assignment[2] ?? "");
    if (!version) {
      skippedNonExact = true;
      continue;
    }

    dependencies.push({
      ecosystem: PYPI_ECOSYSTEM,
      name,
      version,
      manifestPath: readResult.absolutePath,
      manifestLine: index + 1
    });
  }

  const warnings = skippedNonExact ? [`${PIPFILE_HINT} (${path.basename(readResult.absolutePath)})`] : [];
  return {
    dependencies: dedupeCoordinates(dependencies),
    warnings
  };
}
