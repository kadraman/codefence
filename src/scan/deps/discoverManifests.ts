import fs from "node:fs";
import path from "node:path";
import { isDependencyManifest } from "../../manifests";

/** Directory names skipped when walking the repo for dependency manifests. */
export const DEPS_TREE_SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  ".codefence",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".next",
  "vendor",
  "__pycache__"
]);

function normalizeRelative(cwd: string, absolutePath: string): string {
  return path.relative(cwd, absolutePath).replace(/\\/g, "/");
}

function walkForManifests(dir: string, cwd: string, out: Set<string>): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (DEPS_TREE_SKIP_DIR_NAMES.has(entry.name)) {
        continue;
      }
      walkForManifests(path.join(dir, entry.name), cwd, out);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    const relative = normalizeRelative(cwd, fullPath);
    if (isDependencyManifest(relative)) {
      out.add(relative);
    }
  }
}

/**
 * Find all dependency manifest files under the given roots (default: repository root).
 * Paths are returned relative to `cwd`, sorted for stable output and caching.
 */
export function discoverDependencyManifests(cwd: string, roots?: string[]): string[] {
  const resolvedCwd = path.resolve(cwd);
  const scanRoots =
    roots && roots.length > 0
      ? roots.map((root) => {
          const absolute = path.isAbsolute(root) ? root : path.resolve(resolvedCwd, root);
          return fs.existsSync(absolute) ? absolute : null;
        }).filter((root): root is string => root !== null)
      : [resolvedCwd];

  const found = new Set<string>();
  for (const root of scanRoots) {
    const stat = fs.statSync(root, { throwIfNoEntry: false });
    if (!stat) {
      continue;
    }
    if (stat.isFile()) {
      const relative = normalizeRelative(resolvedCwd, root);
      if (isDependencyManifest(relative)) {
        found.add(relative);
      }
      continue;
    }
    if (stat.isDirectory()) {
      walkForManifests(root, resolvedCwd, found);
    }
  }

  return [...found].sort();
}
