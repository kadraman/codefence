import path from "node:path";
import { DependencyCoordinate } from "../types";
import { DependencyExtractionResult, dedupeCoordinates, readManifestSource } from "./shared";

export const PYPI_ECOSYSTEM = "PyPI";
const REQUIREMENTS_HINT = "Skipped non-exact requirements.txt entries; pin versions with == to enable OSV lookups.";

function parsePinnedRequirement(line: string): { name: string; version: string } | null {
  const withoutComment = line.replace(/\s+#.*$/, "").trim();
  if (!withoutComment || withoutComment.startsWith("-")) {
    return null;
  }

  const markerSplit = withoutComment.split(";");
  const requirement = markerSplit[0]?.trim() ?? "";
  const match = requirement.match(
    /^([A-Za-z0-9][A-Za-z0-9._-]*)(?:\[[^\]]+\])?\s*==\s*([A-Za-z0-9][0-9A-Za-z._+-]*)$/
  );
  if (!match) {
    return null;
  }

  function isRequirementsDirective(line: string): boolean {
    return /^(-r|--requirement|-c|--constraint|-e|--editable|--index-url|--extra-index-url|--find-links)\b/.test(
      line
    );
  }

  return {
    name: match[1],
    version: match[2]
  };
}

export function extractRequirementsTxtDependencies(manifestPath: string): DependencyExtractionResult {
  const readResult = readManifestSource(manifestPath);
  if (!readResult.source) {
    return { dependencies: [], warnings: readResult.warning ? [readResult.warning] : [] };
  }

  const dependencies: DependencyCoordinate[] = [];
  let skippedNonExact = false;
  const lines = readResult.source.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]?.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const parsed = parsePinnedRequirement(lines[index] ?? "");
    if (!parsed) {
      if (isRequirementsDirective(line)) {
        continue;
      }
      skippedNonExact = true;
      continue;
    }

    dependencies.push({
      ecosystem: PYPI_ECOSYSTEM,
      name: parsed.name,
      version: parsed.version,
      manifestPath: readResult.absolutePath,
      manifestLine: index + 1
    });
  }

  const warnings = skippedNonExact
    ? [`${REQUIREMENTS_HINT} (${path.basename(readResult.absolutePath)})`]
    : [];

  return {
    dependencies: dedupeCoordinates(dependencies),
    warnings
  };
}
