import path from "node:path";
import { DependencyCoordinate } from "../types";
import { DependencyExtractionResult, dedupeCoordinates, readManifestSource } from "./shared";
import { PYPI_ECOSYSTEM } from "./requirementsTxt";

const PYPROJECT_HINT =
  "Skipped non-exact pyproject.toml dependency specs; pin versions with == to enable OSV lookups.";

function parseRequirementString(spec: string): { name: string; version: string } | null {
  const requirement = spec.split(";")[0]?.trim() ?? "";
  const match = requirement.match(
    /^([A-Za-z0-9][A-Za-z0-9._-]*)(?:\[[^\]]+\])?\s*==\s*([A-Za-z0-9][0-9A-Za-z._+-]*)$/i
  );
  if (!match) {
    return null;
  }
  return {
    name: match[1],
    version: match[2]
  };
}

function parseDependencyArrayLine(line: string): string[] {
  const matches = line.matchAll(/["']([^"']+)["']/g);
  return Array.from(matches, (match) => match[1]);
}

export function extractPyprojectTomlDependencies(manifestPath: string): DependencyExtractionResult {
  const readResult = readManifestSource(manifestPath);
  if (!readResult.source) {
    return { dependencies: [], warnings: readResult.warning ? [readResult.warning] : [] };
  }

  const dependencies: DependencyCoordinate[] = [];
  let skippedNonExact = false;
  let section = "";
  let activeArray: "project-dependencies" | "project-optional-dependencies" | null = null;
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
      activeArray = null;
      continue;
    }

    if (section === "project") {
      if (!activeArray && /^\s*dependencies\s*=\s*\[/.test(rawLine)) {
        activeArray = "project-dependencies";
      }
      if (activeArray !== "project-dependencies") {
        continue;
      }

      for (const spec of parseDependencyArrayLine(rawLine)) {
        const parsed = parseRequirementString(spec);
        if (!parsed) {
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

      if (rawLine.includes("]")) {
        activeArray = null;
      }
      continue;
    }

    if (section !== "project.optional-dependencies") {
      continue;
    }

    if (!activeArray) {
      const assignmentMatch = rawLine.match(/^\s*["']?[A-Za-z0-9._-]+["']?\s*=\s*\[/);
      if (!assignmentMatch) {
        continue;
      }
      activeArray = "project-optional-dependencies";
    }

    for (const spec of parseDependencyArrayLine(rawLine)) {
      const parsed = parseRequirementString(spec);
      if (!parsed) {
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

    if (rawLine.includes("]")) {
      activeArray = null;
    }
  }

  const warnings = skippedNonExact
    ? [`${PYPROJECT_HINT} (${path.basename(readResult.absolutePath)})`]
    : [];
  return {
    dependencies: dedupeCoordinates(dependencies),
    warnings
  };
}
