import path from "node:path";
import { DependencyCoordinate } from "../types";
import {
  DependencyExtractionResult,
  type DepsExtractionWarning,
  dedupeCoordinates,
  depsExtractionWarning,
  manifestReadWarning,
  nonExactSpecWarning,
  readManifestSource
} from "./shared";

export const PYPI_ECOSYSTEM = "PyPI";

const MAX_REQUIREMENTS_INCLUDE_DEPTH = 32;
const MAX_REQUIREMENTS_INCLUDE_FILES = 64;

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

  return {
    name: match[1],
    version: match[2]
  };
}

function parseRequirementInclude(line: string): string | null {
  const withoutComment = line.replace(/\s+#.*$/, "").trim();
  const match = withoutComment.match(/^(-r|--requirement)\s+(.+)$/);
  if (!match) {
    return null;
  }

  let target = match[2]?.trim() ?? "";
  const quotedMatch = target.match(/^["'](.+)["']$/);
  return (quotedMatch?.[1] ?? target).trim() || null;
}

function isSkippedRequirementsDirective(line: string): boolean {
  return /^(-c|--constraint|-e|--editable|--index-url|--extra-index-url|--find-links)\b/.test(line);
}

interface RequirementsWalkState {
  rootManifestPath: string;
  visited: Set<string>;
  filesRead: number;
  warnings: DepsExtractionWarning[];
}

function walkRequirementsFile(
  manifestPath: string,
  depth: number,
  state: RequirementsWalkState
): { dependencies: DependencyCoordinate[]; skippedNonExact: boolean } {
  const readResult = readManifestSource(manifestPath);
  if (!readResult.source) {
    if (readResult.warning) {
      state.warnings.push(manifestReadWarning(readResult.absolutePath, readResult.warning));
    } else if (manifestPath !== state.rootManifestPath) {
      state.warnings.push(
        depsExtractionWarning(
          state.rootManifestPath,
          "deps.requirements-include-missing",
          `Included requirements file not found: ${path.basename(manifestPath)}.`,
          "Fix the -r path or commit the missing requirements file."
        )
      );
    }
    return { dependencies: [], skippedNonExact: false };
  }

  if (state.visited.has(readResult.absolutePath)) {
    state.warnings.push(
      depsExtractionWarning(
        state.rootManifestPath,
        "deps.requirements-include-cycle",
        `Circular -r include detected involving ${path.basename(readResult.absolutePath)}.`,
        "Remove circular -r references between requirements files."
      )
    );
    return { dependencies: [], skippedNonExact: false };
  }

  if (depth >= MAX_REQUIREMENTS_INCLUDE_DEPTH) {
    state.warnings.push(
      depsExtractionWarning(
        state.rootManifestPath,
        "deps.requirements-include-limit",
        `Stopped following -r includes after ${MAX_REQUIREMENTS_INCLUDE_DEPTH} levels.`,
        "Flatten requirements files or reduce nested -r depth."
      )
    );
    return { dependencies: [], skippedNonExact: false };
  }

  if (state.filesRead >= MAX_REQUIREMENTS_INCLUDE_FILES) {
    state.warnings.push(
      depsExtractionWarning(
        state.rootManifestPath,
        "deps.requirements-include-limit",
        `Stopped following -r includes after ${MAX_REQUIREMENTS_INCLUDE_FILES} files.`,
        "Reduce the number of included requirements files."
      )
    );
    return { dependencies: [], skippedNonExact: false };
  }

  state.visited.add(readResult.absolutePath);
  state.filesRead += 1;

  const dependencies: DependencyCoordinate[] = [];
  let skippedNonExact = false;
  const lines = readResult.source.split(/\r?\n/);
  const manifestDir = path.dirname(readResult.absolutePath);

  for (let index = 0; index < lines.length; index++) {
    const rawLine = lines[index] ?? "";
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const includeTarget = parseRequirementInclude(rawLine);
    if (includeTarget) {
      const includedPath = path.resolve(manifestDir, includeTarget);
      const included = walkRequirementsFile(includedPath, depth + 1, state);
      dependencies.push(...included.dependencies);
      skippedNonExact ||= included.skippedNonExact;
      continue;
    }

    const parsed = parsePinnedRequirement(rawLine);
    if (!parsed) {
      if (isSkippedRequirementsDirective(line)) {
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

  return { dependencies, skippedNonExact };
}

export function extractRequirementsTxtDependencies(manifestPath: string): DependencyExtractionResult {
  const absolutePath = path.resolve(manifestPath);
  const state: RequirementsWalkState = {
    rootManifestPath: absolutePath,
    visited: new Set<string>(),
    filesRead: 0,
    warnings: []
  };

  const { dependencies, skippedNonExact } = walkRequirementsFile(absolutePath, 0, state);
  if (skippedNonExact) {
    state.warnings.push(nonExactSpecWarning(absolutePath, "requirements.txt"));
  }

  return {
    dependencies: dedupeCoordinates(dependencies),
    warnings: state.warnings
  };
}
