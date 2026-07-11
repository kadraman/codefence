import { DependencyCoordinate } from "../types";
import {
  DependencyExtractionResult,
  dedupeCoordinates,
  findBestEffortLine,
  manifestReadWarning,
  nonExactSpecWarning,
  readManifestSource
} from "./shared";
import { MAVEN_ECOSYSTEM, normalizeMavenVersion } from "./pomXml";

/**
 * Configuration method names that declare dependencies in Groovy/Kotlin Gradle DSL.
 * Limited v1: only string/GAV literals on these methods.
 */
const GRADLE_CONFIG_METHODS =
  "implementation|api|compileOnly|runtimeOnly|testImplementation|testCompileOnly|testRuntimeOnly|compile|runtime|testCompile|testRuntime|annotationProcessor|kapt|classpath";

const GRADLE_CONFIG_RE = new RegExp(`\\b(${GRADLE_CONFIG_METHODS})\\b`, "i");

// Groovy/Kotlin string coordinate: implementation "g:a:1.2.3" / implementation("g:a:1.2.3")
const GRADLE_STRING_DEP_RE = new RegExp(
  `\\b(${GRADLE_CONFIG_METHODS})\\s*\\(?\\s*["']([^"']+)["']\\s*\\)?`,
  "gi"
);

function stripInlineComment(line: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const prev = line[i - 1];
    if (ch === "'" && !inDouble && prev !== "\\") {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle && prev !== "\\") {
      inDouble = !inDouble;
    } else if (ch === "/" && line[i + 1] === "/" && !inSingle && !inDouble) {
      return line.slice(0, i);
    }
  }
  return line;
}

function parseGavString(raw: string): { groupId: string; artifactId: string; version: string } | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes("$") || trimmed.includes("(") || trimmed.includes("@")) {
    return null;
  }

  const parts = trimmed.split(":");
  if (parts.length < 3) {
    return null;
  }

  const groupId = parts[0]?.trim();
  const artifactId = parts[1]?.trim();
  const version = parts[2]?.trim();
  if (!groupId || !artifactId || !version) {
    return null;
  }

  return { groupId, artifactId, version };
}

function parseMapNotation(
  line: string
): { groupId: string; artifactId: string; version: string } | null {
  if (!GRADLE_CONFIG_RE.test(line)) {
    return null;
  }

  const groupMatch = line.match(/\bgroup\s*[:=]\s*["']([^"']+)["']/i);
  const nameMatch = line.match(/\bname\s*[:=]\s*["']([^"']+)["']/i);
  const versionMatch = line.match(/\bversion\s*[:=]\s*["']([^"']+)["']/i);
  if (!groupMatch?.[1] || !nameMatch?.[1] || !versionMatch?.[1]) {
    return null;
  }

  return {
    groupId: groupMatch[1].trim(),
    artifactId: nameMatch[1].trim(),
    version: versionMatch[1].trim()
  };
}

function pushCoordinate(
  dependencies: DependencyCoordinate[],
  manifestPath: string,
  source: string,
  groupId: string,
  artifactId: string,
  version: string,
  lineNumber: number
): void {
  const name = `${groupId}:${artifactId}`;
  dependencies.push({
    ecosystem: MAVEN_ECOSYSTEM,
    name,
    version,
    manifestPath,
    manifestLine: lineNumber || findBestEffortLine(source, [artifactId, version]) || findBestEffortLine(source, [name])
  });
}

export function extractGradleDependencies(manifestPath: string): DependencyExtractionResult {
  const readResult = readManifestSource(manifestPath);
  if (!readResult.source) {
    return {
      dependencies: [],
      warnings: readResult.warning ? [manifestReadWarning(readResult.absolutePath, readResult.warning)] : []
    };
  }

  const source = readResult.source;
  const lines = source.split(/\r?\n/);
  const dependencies: DependencyCoordinate[] = [];
  let skippedNonExact = false;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const rawLine = lines[lineIndex] ?? "";
    const line = stripInlineComment(rawLine).trim();
    if (!line || line.startsWith("//")) {
      continue;
    }

    let matchedLiteral = false;

    GRADLE_STRING_DEP_RE.lastIndex = 0;
    let stringMatch: RegExpExecArray | null;
    while ((stringMatch = GRADLE_STRING_DEP_RE.exec(line)) !== null) {
      const gavRaw = stringMatch[2] ?? "";
      const gav = parseGavString(gavRaw);
      if (!gav) {
        if (gavRaw.includes(":") || gavRaw.includes("$")) {
          skippedNonExact = true;
        }
        continue;
      }

      const version = normalizeMavenVersion(gav.version);
      if (!version) {
        skippedNonExact = true;
        continue;
      }

      matchedLiteral = true;
      pushCoordinate(
        dependencies,
        readResult.absolutePath,
        source,
        gav.groupId,
        gav.artifactId,
        version,
        lineIndex + 1
      );
    }

    if (matchedLiteral) {
      continue;
    }

    const mapGav = parseMapNotation(line);
    if (!mapGav) {
      continue;
    }

    if (mapGav.groupId.includes("$") || mapGav.artifactId.includes("$") || mapGav.version.includes("$")) {
      skippedNonExact = true;
      continue;
    }

    const version = normalizeMavenVersion(mapGav.version);
    if (!version) {
      skippedNonExact = true;
      continue;
    }

    pushCoordinate(
      dependencies,
      readResult.absolutePath,
      source,
      mapGav.groupId,
      mapGav.artifactId,
      version,
      lineIndex + 1
    );
  }

  const warnings = skippedNonExact
    ? [nonExactSpecWarning(readResult.absolutePath, "build.gradle")]
    : [];

  return {
    dependencies: dedupeCoordinates(dependencies),
    warnings
  };
}
