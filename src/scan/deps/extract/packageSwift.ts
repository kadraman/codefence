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

const PACKAGE_CALL_START_RE = /\.package\s*\(/gi;

/** Match exact pin forms inside a single `.package(...)` argument list. */
const PACKAGE_EXACT_IN_ARGS_RE =
  /url\s*:\s*["']([^"']+)["'][\s\S]*?(?:\.exact\s*\(\s*["']([^"']+)["']\s*\)|exact\s*:\s*["']([^"']+)["'])/i;

function extractBalancedCallArgs(source: string, openParenIndex: number): string | null {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (let index = openParenIndex; index < source.length; index++) {
    const char = source[index] ?? "";

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\" && (inSingle || inDouble)) {
      escaped = true;
      continue;
    }
    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (inSingle || inDouble) {
      continue;
    }

    if (char === "(") {
      depth += 1;
      continue;
    }
    if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openParenIndex + 1, index);
      }
    }
  }

  return null;
}

interface PackageSwiftCall {
  args: string;
  startIndex: number;
}

function findPackageCalls(source: string): PackageSwiftCall[] {
  const calls: PackageSwiftCall[] = [];
  PACKAGE_CALL_START_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = PACKAGE_CALL_START_RE.exec(source)) !== null) {
    const openParenIndex = (match.index ?? 0) + match[0].length - 1;
    const args = extractBalancedCallArgs(source, openParenIndex);
    if (args === null) {
      continue;
    }
    calls.push({ args, startIndex: match.index ?? 0 });
  }

  return calls;
}

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

  for (const call of findPackageCalls(readResult.source)) {
    const exactMatch = call.args.match(PACKAGE_EXACT_IN_ARGS_RE);
    if (!exactMatch) {
      skippedNonExact = true;
      continue;
    }

    const url = exactMatch[1] ?? "";
    const versionRaw = exactMatch[2] ?? exactMatch[3] ?? "";
    const name = normalizeSwiftUrlPackageName(url);
    const version = normalizeSwiftExactVersion(versionRaw);
    if (!name || !version) {
      skippedNonExact = true;
      continue;
    }

    const line = readResult.source.slice(0, call.startIndex).split(/\r?\n/).length;
    dependencies.push({
      ecosystem: SWIFT_URL_ECOSYSTEM,
      name,
      version,
      manifestPath: readResult.absolutePath,
      manifestLine: line
    });
  }

  return {
    dependencies: dedupeCoordinates(dependencies),
    warnings: skippedNonExact ? [nonExactSpecWarning(readResult.absolutePath, "Package.swift")] : []
  };
}
