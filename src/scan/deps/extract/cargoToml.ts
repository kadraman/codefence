import { DependencyCoordinate } from "../types";
import {
  DependencyExtractionResult,
  dedupeCoordinates,
  manifestReadWarning,
  nonExactSpecWarning,
  readManifestSource
} from "./shared";

/** OSV ecosystem id for crates.io packages. */
export const CRATES_IO_ECOSYSTEM = "crates.io";

const DEPENDENCY_TABLE_PREFIX =
  "(?:(?:build-|dev-)?dependencies|workspace\\.dependencies|target\\..+\\.(?:(?:build-|dev-)?dependencies))";

const DEPENDENCY_TABLE_RE = new RegExp(`^${DEPENDENCY_TABLE_PREFIX}$`, "i");

const NAMED_DEPENDENCY_TABLE_RE = new RegExp(
  `^(${DEPENDENCY_TABLE_PREFIX})\\.([A-Za-z0-9_-]+)$`,
  "i"
);

const INLINE_ASSIGNMENT_RE = /^\s*(?:["']([A-Za-z0-9_-]+)["']|([A-Za-z0-9_-]+))\s*=\s*(.+?)\s*$/;

/** Cargo exact pin: "=1.2.3" (bare "1.2.3" is a caret range). */
const EXACT_VERSION_RE = /^=\s*([0-9][0-9A-Za-z.+_-]*)$/;

/** path/git/workspace sources are not fetched from crates.io, even when version is set. */
const NON_REGISTRY_SOURCE_RE = /(?:^|[{\s,])(?:path|git|workspace)\s*=/;

interface PendingNamedDependency {
  name: string;
  version: string | null;
  versionLine: number;
  nonRegistry: boolean;
  skippedNonExact: boolean;
}

function stripInlineTomlComment(line: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (char === "#" && !inSingle && !inDouble) {
      return line.slice(0, index).trimEnd();
    }
  }
  return line;
}

function unquoteTomlString(raw: string): string | null {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1);
  }
  return null;
}

function normalizeCargoExactVersion(raw: string): string | null {
  const unquoted = unquoteTomlString(raw.trim()) ?? raw.trim();
  const match = unquoted.match(EXACT_VERSION_RE);
  return match?.[1] ?? null;
}

function parseDependencyValue(rawValue: string): { version: string | null; skippedNonExact: boolean } {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return { version: null, skippedNonExact: true };
  }

  if (trimmed.startsWith("{")) {
    if (NON_REGISTRY_SOURCE_RE.test(trimmed)) {
      return { version: null, skippedNonExact: true };
    }

    const versionMatch = trimmed.match(/\bversion\s*=\s*(["'][^"']+["']|[^\s,}]+)/i);
    if (!versionMatch?.[1]) {
      return { version: null, skippedNonExact: true };
    }

    const version = normalizeCargoExactVersion(versionMatch[1]);
    return { version, skippedNonExact: version === null };
  }

  const version = normalizeCargoExactVersion(trimmed);
  if (version) {
    return { version, skippedNonExact: false };
  }

  // Bare semver strings are caret ranges in Cargo.toml.
  return { version: null, skippedNonExact: true };
}

export function extractCargoTomlDependencies(manifestPath: string): DependencyExtractionResult {
  const readResult = readManifestSource(manifestPath);
  if (!readResult.source) {
    return {
      dependencies: [],
      warnings: readResult.warning ? [manifestReadWarning(readResult.absolutePath, readResult.warning)] : []
    };
  }

  const dependencies: DependencyCoordinate[] = [];
  let skippedNonExact = false;
  let section = "";
  let pendingNamed: PendingNamedDependency | null = null;
  const lines = readResult.source.split(/\r?\n/);

  const flushPendingNamed = (): void => {
    if (!pendingNamed) {
      return;
    }

    const pending = pendingNamed;
    pendingNamed = null;

    if (pending.nonRegistry) {
      skippedNonExact = true;
      return;
    }

    if (pending.version) {
      dependencies.push({
        ecosystem: CRATES_IO_ECOSYSTEM,
        name: pending.name,
        version: pending.version,
        manifestPath: readResult.absolutePath,
        manifestLine: pending.versionLine
      });
      return;
    }

    if (pending.skippedNonExact) {
      skippedNonExact = true;
    }
  };

  for (let index = 0; index < lines.length; index++) {
    const rawLine = stripInlineTomlComment(lines[index] ?? "");
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      flushPendingNamed();
      const sectionName = (sectionMatch[1] ?? "").trim();
      const namedMatch = sectionName.match(NAMED_DEPENDENCY_TABLE_RE);
      if (namedMatch) {
        section = (namedMatch[1] ?? "").toLowerCase();
        const name = namedMatch[2] ?? "";
        pendingNamed = name
          ? {
              name,
              version: null,
              versionLine: 0,
              nonRegistry: false,
              skippedNonExact: false
            }
          : null;
      } else {
        section = sectionName.toLowerCase();
      }
      continue;
    }

    if (pendingNamed) {
      if (/^\s*(?:path|git|workspace)\s*=/.test(rawLine)) {
        pendingNamed.nonRegistry = true;
        pendingNamed.skippedNonExact = true;
        continue;
      }

      const versionAssignment = rawLine.match(/^\s*version\s*=\s*(.+?)\s*$/i);
      if (!versionAssignment) {
        continue;
      }

      const parsed = parseDependencyValue(versionAssignment[1] ?? "");
      if (!parsed.version) {
        pendingNamed.skippedNonExact = true;
        continue;
      }

      pendingNamed.version = parsed.version;
      pendingNamed.versionLine = index + 1;
      continue;
    }

    if (!DEPENDENCY_TABLE_RE.test(section)) {
      continue;
    }

    const assignment = rawLine.match(INLINE_ASSIGNMENT_RE);
    if (!assignment) {
      continue;
    }

    const name = assignment[1] ?? assignment[2];
    if (!name) {
      continue;
    }

    const parsed = parseDependencyValue(assignment[3] ?? "");
    if (!parsed.version) {
      if (parsed.skippedNonExact) {
        skippedNonExact = true;
      }
      continue;
    }

    dependencies.push({
      ecosystem: CRATES_IO_ECOSYSTEM,
      name,
      version: parsed.version,
      manifestPath: readResult.absolutePath,
      manifestLine: index + 1
    });
  }

  flushPendingNamed();

  return {
    dependencies: dedupeCoordinates(dependencies),
    warnings: skippedNonExact ? [nonExactSpecWarning(readResult.absolutePath, "Cargo.toml")] : []
  };
}
