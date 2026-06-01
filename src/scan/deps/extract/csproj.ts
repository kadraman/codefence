import { DependencyCoordinate } from "../types";
import {
  DependencyExtractionResult,
  dedupeCoordinates,
  findBestEffortLine,
  manifestReadWarning,
  nonExactSpecWarning,
  readManifestSource
} from "./shared";

export const NUGET_ECOSYSTEM = "NuGet";

const PACKAGE_REFERENCE_OPEN_RE = /<PackageReference\b/gi;
const CHILD_VERSION_RE = /<Version>([^<]+)<\/Version>/i;

function parseXmlAttributes(attributeText: string): Map<string, string> {
  const attributes = new Map<string, string>();
  const attributeRe = /([\w.:]+)\s*=\s*["']([^"']*)["']/g;
  let match: RegExpExecArray | null;
  while ((match = attributeRe.exec(attributeText)) !== null) {
    const key = match[1];
    const value = match[2];
    if (key && value !== undefined) {
      attributes.set(key, value);
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

function readOpeningTag(
  source: string,
  startIndex: number
): { attributes: Map<string, string>; selfClosing: boolean; bodyStart: number; tagEnd: number } | null {
  const slice = source.slice(startIndex);
  if (!slice.startsWith("<PackageReference")) {
    return null;
  }

  const tagEndMatch = slice.match(/^<PackageReference\b([^>]*?)(\/>|>)/i);
  if (!tagEndMatch) {
    return null;
  }

  const attributeText = tagEndMatch[1] ?? "";
  const terminator = tagEndMatch[2] ?? ">";
  const tagEnd = startIndex + tagEndMatch[0].length;
  return {
    attributes: parseXmlAttributes(attributeText),
    selfClosing: terminator === "/>",
    bodyStart: tagEnd,
    tagEnd
  };
}

function readChildVersion(source: string, bodyStart: number): string | null {
  const closeIndex = source.indexOf("</PackageReference>", bodyStart);
  if (closeIndex < 0) {
    return null;
  }

  const body = source.slice(bodyStart, closeIndex);
  const match = body.match(CHILD_VERSION_RE);
  return match?.[1]?.trim() ?? null;
}

export function extractCsprojDependencies(manifestPath: string): DependencyExtractionResult {
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

  PACKAGE_REFERENCE_OPEN_RE.lastIndex = 0;
  while ((match = PACKAGE_REFERENCE_OPEN_RE.exec(source)) !== null) {
    const startIndex = match.index;
    const opening = readOpeningTag(source, startIndex);
    if (!opening) {
      continue;
    }

    const include = opening.attributes.get("Include")?.trim();
    if (!include) {
      continue;
    }

    let rawVersion = opening.attributes.get("Version")?.trim() ?? null;
    if (!rawVersion && !opening.selfClosing) {
      rawVersion = readChildVersion(source, opening.bodyStart);
    }

    if (!rawVersion) {
      if (!opening.attributes.has("Update")) {
        skippedNonExact = true;
      }
      continue;
    }

    const version = normalizeNuGetVersion(rawVersion);
    if (!version) {
      skippedNonExact = true;
      continue;
    }

    dependencies.push({
      ecosystem: NUGET_ECOSYSTEM,
      name: include,
      version,
      manifestPath: readResult.absolutePath,
      manifestLine:
        lineNumberAtIndex(source, startIndex) ||
        findBestEffortLine(source, [include, rawVersion]) ||
        findBestEffortLine(source, [include])
    });
  }

  const warnings = skippedNonExact
    ? [nonExactSpecWarning(readResult.absolutePath, "csproj")]
    : [];

  return {
    dependencies: dedupeCoordinates(dependencies),
    warnings
  };
}
