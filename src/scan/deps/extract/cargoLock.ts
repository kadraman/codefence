import { DependencyCoordinate } from "../types";
import {
  DependencyExtractionResult,
  MAX_LOCKFILE_BYTES,
  dedupeCoordinates,
  emptyExtractionResult,
  manifestReadWarning,
  readManifestSource
} from "./shared";
import { CRATES_IO_ECOSYSTEM } from "./cargoToml";

/** crates.io registry source as written by modern Cargo.lock files. */
const CRATES_IO_SOURCE_RE = /^registry\+https:\/\/github\.com\/rust-lang\/crates\.io-index$/i;

const PACKAGE_NAME_RE = /^[A-Za-z0-9_-]+$/;
const PACKAGE_VERSION_RE = /^[0-9][0-9A-Za-z.+_-]*$/;

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

interface CargoLockPackage {
  name: string | null;
  version: string | null;
  source: string | null;
  nameLine: number;
  versionLine: number;
}

export function extractCargoLockDependencies(manifestPath: string): DependencyExtractionResult {
  const readResult = readManifestSource(manifestPath, { maxBytes: MAX_LOCKFILE_BYTES });
  if (!readResult.source) {
    if (readResult.warning) {
      return emptyExtractionResult(manifestReadWarning(readResult.absolutePath, readResult.warning));
    }
    return emptyExtractionResult();
  }

  const dependencies: DependencyCoordinate[] = [];
  const lines = readResult.source.split(/\r?\n/);
  let inPackage = false;
  let current: CargoLockPackage | null = null;

  const flush = (): void => {
    if (!current?.name || !current.version || !current.source) {
      current = null;
      return;
    }

    if (!CRATES_IO_SOURCE_RE.test(current.source)) {
      current = null;
      return;
    }

    if (!PACKAGE_NAME_RE.test(current.name) || !PACKAGE_VERSION_RE.test(current.version)) {
      current = null;
      return;
    }

    dependencies.push({
      ecosystem: CRATES_IO_ECOSYSTEM,
      name: current.name,
      version: current.version,
      manifestPath: readResult.absolutePath,
      manifestLine: current.versionLine || current.nameLine || 0
    });
    current = null;
  };

  for (let index = 0; index < lines.length; index++) {
    const rawLine = lines[index] ?? "";
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    if (line === "[[package]]") {
      if (inPackage) {
        flush();
      }
      inPackage = true;
      current = {
        name: null,
        version: null,
        source: null,
        nameLine: 0,
        versionLine: 0
      };
      continue;
    }

    if (line.startsWith("[")) {
      if (inPackage) {
        flush();
      }
      inPackage = false;
      current = null;
      continue;
    }

    if (!inPackage || !current) {
      continue;
    }

    const assignment = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/);
    if (!assignment) {
      continue;
    }

    const key = assignment[1]?.toLowerCase();
    const rawValue = assignment[2] ?? "";
    const value = unquoteTomlString(rawValue) ?? rawValue.trim();

    if (key === "name") {
      current.name = value;
      current.nameLine = index + 1;
    } else if (key === "version") {
      current.version = value;
      current.versionLine = index + 1;
    } else if (key === "source") {
      current.source = value;
    }
  }

  if (inPackage) {
    flush();
  }

  return {
    dependencies: dedupeCoordinates(dependencies),
    warnings: []
  };
}
