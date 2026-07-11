import fs from "node:fs";
import path from "node:path";
import { DependencyCoordinate } from "../types";
import { extractCsprojDependencies } from "./csproj";
import {
  DependencyExtractionResult,
  dedupeCoordinates,
  depsExtractionWarning,
  manifestReadWarning,
  readManifestSource
} from "./shared";

/**
 * Visual Studio solution project line:
 * Project("{GUID}") = "Name", "relative\path\App.csproj", "{GUID}"
 */
const SLN_PROJECT_RE =
  /^Project\("[^"]+"\)\s*=\s*"[^"]+"\s*,\s*"([^"]+)"\s*,\s*"[^"]+"\s*$/i;

export function discoverCsprojPathsFromSln(slnPath: string): {
  absolutePath: string;
  csprojPaths: string[];
  warning?: string;
} {
  const readResult = readManifestSource(slnPath);
  if (!readResult.source) {
    return {
      absolutePath: readResult.absolutePath,
      csprojPaths: [],
      warning: readResult.warning
    };
  }

  const slnDir = path.dirname(readResult.absolutePath);
  const csprojPaths: string[] = [];
  const seen = new Set<string>();

  for (const rawLine of readResult.source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith("Project(")) {
      continue;
    }

    const match = line.match(SLN_PROJECT_RE);
    const relativeProject = match?.[1]?.trim();
    if (!relativeProject) {
      continue;
    }

    const normalizedRelative = relativeProject.replace(/\\/g, "/");
    if (!normalizedRelative.toLowerCase().endsWith(".csproj")) {
      continue;
    }

    const absoluteCsproj = path.resolve(slnDir, normalizedRelative);
    if (seen.has(absoluteCsproj)) {
      continue;
    }
    seen.add(absoluteCsproj);

    if (!fs.existsSync(absoluteCsproj)) {
      continue;
    }

    csprojPaths.push(absoluteCsproj);
  }

  return {
    absolutePath: readResult.absolutePath,
    csprojPaths
  };
}

/**
 * Extract NuGet coordinates by discovering `.csproj` paths referenced from a `.sln`.
 * Coordinates use the `.csproj` path as `manifestPath` (no OSV query on the `.sln` itself).
 */
export function extractSlnDependencies(manifestPath: string): DependencyExtractionResult {
  const discovery = discoverCsprojPathsFromSln(manifestPath);
  if (discovery.warning && discovery.csprojPaths.length === 0) {
    return {
      dependencies: [],
      warnings: [manifestReadWarning(discovery.absolutePath, discovery.warning)]
    };
  }

  const dependencies: DependencyCoordinate[] = [];
  const warnings = [];

  if (discovery.csprojPaths.length === 0) {
    warnings.push(
      depsExtractionWarning(
        discovery.absolutePath,
        "deps.sln-no-csproj",
        "No readable .csproj project references found in solution file.",
        "Ensure Project entries point to existing .csproj files, or scan those projects directly."
      )
    );
    return { dependencies: [], warnings };
  }

  for (const csprojPath of discovery.csprojPaths) {
    const result = extractCsprojDependencies(csprojPath);
    dependencies.push(...result.dependencies);
    warnings.push(...result.warnings);
  }

  return {
    dependencies: dedupeCoordinates(dependencies),
    warnings
  };
}
