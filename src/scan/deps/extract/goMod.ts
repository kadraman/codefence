import { DependencyCoordinate } from "../types";
import {
  DependencyExtractionResult,
  dedupeCoordinates,
  emptyExtractionResult,
  manifestReadWarning,
  readManifestSource
} from "./shared";

export const GO_ECOSYSTEM = "Go";

// Matches a module path + semver version tag on a require line.
// Module path: printable, no whitespace; version: v<major>.<minor>.<patch>[prerelease/build]
const GO_REQUIRE_LINE_RE =
  /^([A-Za-z0-9][A-Za-z0-9.\-_/]*(?:\/v\d+)?)\s+(v\d+\.\d+\.\d+(?:[.\-][0-9A-Za-z._-]*)*)/;

// Pseudo-version pattern — skip these as they carry no meaningful semver for OSV.
const GO_PSEUDO_VERSION_RE = /^v\d+\.\d+\.\d+-\d{14}-[0-9a-f]{12}$/;

function parseGoVersion(rawVersion: string): string | null {
  if (GO_PSEUDO_VERSION_RE.test(rawVersion)) {
    return null;
  }
  // Strip the mandatory 'v' prefix; OSV Go ecosystem uses bare semver.
  const match = rawVersion.match(/^v(\d+\.\d+\.\d+(?:[.\-][0-9A-Za-z._-]*)?)$/);
  return match?.[1] ?? null;
}

function parseRequireLine(
  line: string
): { name: string; version: string } | null {
  // Strip inline comment (e.g. "// indirect", "// indirect; go 1.17")
  const withoutComment = line.split("//")[0]?.trim() ?? "";
  const match = withoutComment.match(GO_REQUIRE_LINE_RE);
  if (!match) {
    return null;
  }

  const name = match[1];
  const rawVersion = match[2];
  if (!name || !rawVersion) {
    return null;
  }

  const version = parseGoVersion(rawVersion);
  if (!version) {
    return null;
  }

  return { name, version };
}

export function extractGoModDependencies(manifestPath: string): DependencyExtractionResult {
  const readResult = readManifestSource(manifestPath);
  if (!readResult.source) {
    if (readResult.warning) {
      return emptyExtractionResult(manifestReadWarning(readResult.absolutePath, readResult.warning));
    }
    return emptyExtractionResult();
  }

  const source = readResult.source;
  const lines = source.split(/\r?\n/);
  const dependencies: DependencyCoordinate[] = [];
  let inRequireBlock = false;

  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index] ?? "";
    const line = raw.trim();

    if (!inRequireBlock) {
      // Opening block: require ( ...
      if (/^require\s*\($/.test(line)) {
        inRequireBlock = true;
        continue;
      }

      // Single-line: require module/path v1.2.3
      if (line.startsWith("require ")) {
        const rest = line.slice("require ".length).trim();
        const parsed = parseRequireLine(rest);
        if (parsed) {
          dependencies.push({
            ecosystem: GO_ECOSYSTEM,
            name: parsed.name,
            version: parsed.version,
            manifestPath: readResult.absolutePath,
            manifestLine: index + 1
          });
        }
      }
    } else {
      if (line === ")") {
        inRequireBlock = false;
        continue;
      }

      if (!line || line.startsWith("//")) {
        continue;
      }

      const parsed = parseRequireLine(line);
      if (parsed) {
        dependencies.push({
          ecosystem: GO_ECOSYSTEM,
          name: parsed.name,
          version: parsed.version,
          manifestPath: readResult.absolutePath,
          manifestLine: index + 1
        });
      }
    }
  }

  return {
    dependencies: dedupeCoordinates(dependencies),
    warnings: []
  };
}
