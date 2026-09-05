import { DependencyCoordinate } from "../types";
import { NUGET_ECOSYSTEM } from "./csproj";
import {
  DependencyExtractionResult,
  dedupeCoordinates,
  findBestEffortLine,
  manifestReadWarning,
  nonExactSpecWarning,
  readManifestSource
} from "./shared";

const PACKAGE_OPEN_RE = /<package\b/gi;

function parseXmlAttributes(attributeText: string): Map<string, string> {
  const attributes = new Map<string, string>();
  const attributeRe = /([\w.:]+)\s*=\s*["']([^"']*)["']/g;
  let match: RegExpExecArray | null;
  while ((match = attributeRe.exec(attributeText)) !== null) {
    const key = match[1];
    const value = match[2];
    if (key && value !== undefined) {
      attributes.set(key.toLowerCase(), value);
    }
  }
  return attributes;
}

function normalizeNuGetVersion(raw: string): string | null {
  let trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const bracketExact = trimmed.match(/^\[([0-9][^\]]*)\]$/);
  if (bracketExact?.[1]) {
    trimmed = bracketExact[1].trim();
  } else if (/[[\]*,]/.test(trimmed) || trimmed.includes(" ")) {
    return null;
  }

  if (/^[~^>=<]/.test(trimmed)) {
    return null;
  }

  if (!/^\d+\.\d+/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

function lineNumberAtIndex(source: string, index: number): number {
  return source.slice(0, index).split(/\r?\n/).length;
}

export function extractPackagesConfigDependencies(manifestPath: string): DependencyExtractionResult {
  const readResult = readManifestSource(manifestPath);
  if (!readResult.source) {
    return {
      dependencies: [],
      warnings: readResult.warning ? [manifestReadWarning(readResult.absolutePath, readResult.warning)] : []
    };
  }

  const source = readResult.source;
  const dependencies: DependencyCoordinate[] = [];
  let skippedNonExact = false;
  let match: RegExpExecArray | null;

  PACKAGE_OPEN_RE.lastIndex = 0;
  while ((match = PACKAGE_OPEN_RE.exec(source)) !== null) {
    const startIndex = match.index;
    const slice = source.slice(startIndex);
    const tagMatch = slice.match(/^<package\b([^>]*?)(\/>|>)/i);
    if (!tagMatch) {
      continue;
    }

    const attributes = parseXmlAttributes(tagMatch[1] ?? "");
    const id = attributes.get("id")?.trim();
    const rawVersion = attributes.get("version")?.trim();

    if (!id) {
      continue;
    }

    if (!rawVersion) {
      skippedNonExact = true;
      continue;
    }

    const version = normalizeNuGetVersion(rawVersion);
    if (!version) {
      skippedNonExact = true;
      continue;
    }

    dependencies.push({
      ecosystem: NUGET_ECOSYSTEM,
      name: id,
      version,
      manifestPath: readResult.absolutePath,
      manifestLine:
        lineNumberAtIndex(source, startIndex) ||
        findBestEffortLine(source, [id, rawVersion]) ||
        findBestEffortLine(source, [id])
    });
  }

  const warnings = skippedNonExact
    ? [nonExactSpecWarning(readResult.absolutePath, "packages.config")]
    : [];

  return {
    dependencies: dedupeCoordinates(dependencies),
    warnings
  };
}
