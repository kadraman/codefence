import { DependencyCoordinate } from "../types";
import {
  DependencyExtractionResult,
  MAX_LOCKFILE_BYTES,
  NPM_ECOSYSTEM,
  dedupeCoordinates,
  emptyExtractionResult,
  normalizeInstalledVersion,
  readManifestSource
} from "./shared";

function splitSelectors(header: string): string[] {
  return header
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((part) => part.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
}

function selectorPackageName(selector: string): string | null {
  const trimmed = selector.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("@")) {
    const match = trimmed.match(/^(@[^/]+\/[^@]+)@/);
    return match?.[1] ?? null;
  }

  const aliasMatch = trimmed.match(/^([^@]+)@npm:/);
  if (aliasMatch) {
    return aliasMatch[1];
  }

  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 0) {
    return null;
  }
  return trimmed.slice(0, atIndex);
}

export function extractYarnLockDependencies(manifestPath: string): DependencyExtractionResult {
  const readResult = readManifestSource(manifestPath, { maxBytes: MAX_LOCKFILE_BYTES });
  if (!readResult.source) {
    return emptyExtractionResult(readResult.warning);
  }

  const lines = readResult.source.split(/\r?\n/);
  if (lines.some((line) => line.trim() === "__metadata:")) {
    return emptyExtractionResult("Unsupported yarn.lock format: Yarn Berry lockfiles are not supported yet.");
  }

  const dependencies: DependencyCoordinate[] = [];
  for (let index = 0; index < lines.length; ) {
    const line = lines[index];
    if (!line.trim() || line.trimStart().startsWith("#")) {
      index += 1;
      continue;
    }

    if (!/^\S.*:$/.test(line)) {
      index += 1;
      continue;
    }

    const headerLine = index + 1;
    const selectors = splitSelectors(line.slice(0, -1));
    index += 1;

    let version: string | null = null;
    while (index < lines.length) {
      const bodyLine = lines[index];
      if (bodyLine.trim() && !bodyLine.startsWith(" ") && !bodyLine.startsWith("\t")) {
        break;
      }

      const versionMatch = bodyLine.trim().match(/^version\s+"([^"]+)"$/);
      if (versionMatch) {
        version = normalizeInstalledVersion(versionMatch[1]);
      }
      index += 1;
    }

    if (!version) {
      continue;
    }

    for (const selector of selectors) {
      const name = selectorPackageName(selector);
      if (!name) {
        continue;
      }

      dependencies.push({
        ecosystem: NPM_ECOSYSTEM,
        name,
        version,
        manifestPath: readResult.absolutePath,
        manifestLine: headerLine
      });
    }
  }

  return {
    dependencies: dedupeCoordinates(dependencies),
    warnings: []
  };
}
