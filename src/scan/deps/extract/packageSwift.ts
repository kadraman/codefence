import { DependencyCoordinate } from "../types";
import {
  DependencyExtractionResult,
  dedupeCoordinates,
  manifestReadWarning,
  nonExactSpecWarning,
  readManifestSource
} from "./shared";

/** OSV ecosystem id for Swift Package Manager (canonical Git URL identity). */
export const SWIFT_URL_ECOSYSTEM = "SwiftURL";

/**
 * Normalize a Swift package repository URL to the OSV SwiftURL package name.
 * Example: https://github.com/apple/swift-nio-http2.git → github.com/apple/swift-nio-http2
 */
export function normalizeSwiftUrlPackageName(rawUrl: string): string | null {
  let value = rawUrl.trim();
  if (!value) {
    return null;
  }

  value = value.replace(/^git\+/i, "");
  value = value.replace(/^https?:\/\//i, "");
  value = value.replace(/^ssh:\/\/[^@]+@/i, "");
  value = value.replace(/^git@([^:]+):/i, "$1/");
  value = value.replace(/\.git$/i, "");
  value = value.replace(/\/+$/, "");

  if (!value || /[\s?#]/.test(value) || !value.includes(".")) {
    return null;
  }

  return value.toLowerCase();
}

function normalizeSwiftExactVersion(raw: string): string | null {
  const trimmed = raw.trim().replace(/^v/i, "");
  if (!/^\d+\.\d+/.test(trimmed)) {
    return null;
  }
  if (/[*^~><|]/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

/** Match `.package(url: "...", .exact("1.2.3"))` and `exact: "1.2.3"` forms. */
const PACKAGE_EXACT_RE =
  /\.package\s*\(\s*url\s*:\s*["']([^"']+)["']\s*,\s*(?:\.exact\s*\(\s*["']([^"']+)["']\s*\)|exact\s*:\s*["']([^"']+)["'])/gi;

export function extractPackageSwiftDependencies(manifestPath: string): DependencyExtractionResult {
  const readResult = readManifestSource(manifestPath);
  if (!readResult.source) {
    return {
      dependencies: [],
      warnings: readResult.warning ? [manifestReadWarning(readResult.absolutePath, readResult.warning)] : []
    };
  }

  const dependencies: DependencyCoordinate[] = [];
  let skippedNonExact = false;
  const lines = readResult.source.split(/\r?\n/);
  const exactMatches = [...readResult.source.matchAll(PACKAGE_EXACT_RE)];

  for (const match of exactMatches) {
    const url = match[1] ?? "";
    const versionRaw = match[2] ?? match[3] ?? "";
    const name = normalizeSwiftUrlPackageName(url);
    const version = normalizeSwiftExactVersion(versionRaw);
    if (!name || !version) {
      skippedNonExact = true;
      continue;
    }

    const matchIndex = match.index ?? 0;
    const line = readResult.source.slice(0, matchIndex).split(/\r?\n/).length;

    dependencies.push({
      ecosystem: SWIFT_URL_ECOSYSTEM,
      name,
      version,
      manifestPath: readResult.absolutePath,
      manifestLine: line
    });
  }

  // Detect .package(...) with from:/branch/revision but no exact pin.
  for (const line of lines) {
    if (/\.package\s*\(/.test(line) && !/\.exact\s*\(|\bexact\s*:/.test(line)) {
      skippedNonExact = true;
      break;
    }
  }

  return {
    dependencies: dedupeCoordinates(dependencies),
    warnings: skippedNonExact ? [nonExactSpecWarning(readResult.absolutePath, "Package.swift")] : []
  };
}
