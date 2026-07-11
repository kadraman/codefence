import { DependencyCoordinate } from "../types";
import {
  DependencyExtractionResult,
  dedupeCoordinates,
  findBestEffortLine,
  manifestReadWarning,
  nonExactSpecWarning,
  readManifestSource
} from "./shared";

export const MAVEN_ECOSYSTEM = "Maven";

const DEPENDENCY_OPEN_RE = /<dependency\b/gi;
const CHILD_TAG_RE = /<(groupId|artifactId|version|type|scope|classifier|optional|systemPath|exclusions)\b[^>]*>([\s\S]*?)<\/\1>/gi;

function lineNumberAtIndex(source: string, index: number): number {
  return source.slice(0, index).split(/\r?\n/).length;
}

function readElementBody(source: string, startIndex: number, tagName: string): { body: string; endIndex: number } | null {
  const openSlice = source.slice(startIndex);
  const openMatch = openSlice.match(new RegExp(`^<${tagName}\\b[^>]*>`, "i"));
  if (!openMatch) {
    return null;
  }

  const bodyStart = startIndex + openMatch[0].length;
  const closeTag = `</${tagName}>`;
  const closeIndex = source.toLowerCase().indexOf(closeTag.toLowerCase(), bodyStart);
  if (closeIndex < 0) {
    return null;
  }

  return {
    body: source.slice(bodyStart, closeIndex),
    endIndex: closeIndex + closeTag.length
  };
}

function parseDependencyChildren(body: string): Map<string, string> {
  const children = new Map<string, string>();
  CHILD_TAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CHILD_TAG_RE.exec(body)) !== null) {
    const tag = match[1]?.toLowerCase();
    const value = match[2]?.trim();
    if (!tag || value === undefined) {
      continue;
    }
    // First occurrence wins (nested exclusions etc. are ignored for coordinates).
    if (!children.has(tag)) {
      children.set(tag, value);
    }
  }
  return children;
}

/**
 * Accept only concrete Maven versions. Skip property placeholders (${...}),
 * ranges ([1.0,2.0)), and SNAPSHOT-only placeholders used as variables.
 */
export function normalizeMavenVersion(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes("${") || trimmed.includes("@")) {
    return null;
  }

  if (/[[\](),]/.test(trimmed) || /\s/.test(trimmed)) {
    return null;
  }

  if (/^[~^><=]/.test(trimmed)) {
    return null;
  }

  // Maven versions are free-form; require at least a leading digit for OSV utility.
  if (!/^\d/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

function isInsideDependencyManagement(source: string, dependencyIndex: number): boolean {
  const before = source.slice(0, dependencyIndex).toLowerCase();
  const lastMgmtOpen = before.lastIndexOf("<dependencymanagement");
  if (lastMgmtOpen < 0) {
    return false;
  }
  const lastMgmtClose = before.lastIndexOf("</dependencymanagement>");
  return lastMgmtClose < lastMgmtOpen;
}

export function extractPomXmlDependencies(manifestPath: string): DependencyExtractionResult {
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

  DEPENDENCY_OPEN_RE.lastIndex = 0;
  while ((match = DEPENDENCY_OPEN_RE.exec(source)) !== null) {
    const startIndex = match.index;
    if (isInsideDependencyManagement(source, startIndex)) {
      continue;
    }

    const element = readElementBody(source, startIndex, "dependency");
    if (!element) {
      continue;
    }

    // Advance the search past this dependency to avoid re-matching nested tags.
    DEPENDENCY_OPEN_RE.lastIndex = Math.max(DEPENDENCY_OPEN_RE.lastIndex, element.endIndex);

    const children = parseDependencyChildren(element.body);
    const groupId = children.get("groupid")?.trim();
    const artifactId = children.get("artifactid")?.trim();
    const rawVersion = children.get("version")?.trim();

    if (!groupId || !artifactId) {
      continue;
    }

    // Skip BOM / property references in coordinates themselves.
    if (groupId.includes("${") || artifactId.includes("${")) {
      skippedNonExact = true;
      continue;
    }

    if (!rawVersion) {
      skippedNonExact = true;
      continue;
    }

    const version = normalizeMavenVersion(rawVersion);
    if (!version) {
      skippedNonExact = true;
      continue;
    }

    const name = `${groupId}:${artifactId}`;
    dependencies.push({
      ecosystem: MAVEN_ECOSYSTEM,
      name,
      version,
      manifestPath: readResult.absolutePath,
      manifestLine:
        lineNumberAtIndex(source, startIndex) ||
        findBestEffortLine(source, [artifactId, rawVersion]) ||
        findBestEffortLine(source, [artifactId])
    });
  }

  const warnings = skippedNonExact ? [nonExactSpecWarning(readResult.absolutePath, "pom.xml")] : [];

  return {
    dependencies: dedupeCoordinates(dependencies),
    warnings
  };
}
