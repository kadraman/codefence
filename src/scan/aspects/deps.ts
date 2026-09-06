import fs from "node:fs";
import path from "node:path";
import { filterDependencyManifests } from "../../manifests";
import { isIgnoredScanPath } from "../../scanner";
import type { Finding } from "../../types";
import { AspectOutcome, ScanAspect, ScanContext } from "../types";
import { isDepsCacheFresh, readDepsCache, writeDepsCache } from "../deps/cache";
import { resolveDepsProviderUrl } from "../deps/config";
import { extractDependenciesForManifestWithDiagnostics } from "../deps/extract";
import { buildDepsSkipMessage } from "../deps/extract/manifestSupport";
import { depsExtractionWarning, type DepsExtractionWarning } from "../deps/extract/shared";
import { queryDependencies } from "../deps/query";
import { DepsFinding, DependencyCoordinate, DEPS_FINDING_RULE_ID } from "../deps/types";
import { printScanWarnings, printUnifiedFindings, writeScanLog, writeScanStatus } from "../output";

const NPM_LOCKFILE_PREFERENCE = ["pnpm-lock.yaml", "package-lock.json", "yarn.lock"] as const;
const NPM_MANIFEST_BASENAMES = new Set(["package.json", ...NPM_LOCKFILE_PREFERENCE]);

const PYTHON_MANIFEST_BASENAMES = new Set([
  "pipfile",
  "pipfile.lock",
  "pyproject.toml",
  "poetry.lock",
  "uv.lock",
  "requirements.txt"
]);

const RUBY_MANIFEST_BASENAMES = new Set(["gemfile", "gemfile.lock"]);
const RUST_MANIFEST_BASENAMES = new Set(["cargo.toml", "cargo.lock"]);
const PHP_MANIFEST_BASENAMES = new Set(["composer.json", "composer.lock"]);
const SWIFT_MANIFEST_BASENAMES = new Set(["package.swift", "package.resolved"]);
const DOTNET_LOCK_BASENAME = "packages.lock.json";

function groupManifestsByRoot(
  manifests: string[],
  cwd: string,
  basenames: Set<string>
): Map<string, Map<string, string>> {
  const roots = new Map<string, Map<string, string>>();

  for (const manifestPath of manifests) {
    const absolute = path.resolve(cwd, manifestPath);
    const baseName = path.basename(manifestPath).toLowerCase();
    if (!basenames.has(baseName)) {
      continue;
    }

    const root = path.dirname(absolute);
    const rootManifests = roots.get(root) ?? new Map<string, string>();
    rootManifests.set(baseName, absolute);
    roots.set(root, rootManifests);
  }

  return roots;
}

function groupDotnetProjectRoots(
  manifests: string[],
  cwd: string
): Map<string, { lockfile: string | null; csproj: string | null }> {
  const roots = new Map<string, { lockfile: string | null; csproj: string | null }>();

  for (const manifestPath of manifests) {
    const absolute = path.resolve(cwd, manifestPath);
    const baseName = path.basename(manifestPath).toLowerCase();
    if (baseName !== DOTNET_LOCK_BASENAME && !baseName.endsWith(".csproj")) {
      continue;
    }

    const root = path.dirname(absolute);
    const entry = roots.get(root) ?? { lockfile: null, csproj: null };
    if (baseName === DOTNET_LOCK_BASENAME) {
      entry.lockfile = absolute;
    } else {
      entry.csproj = absolute;
    }
    roots.set(root, entry);
  }

  return roots;
}

function selectNpmManifests(
  npmRoots: Map<string, Map<string, string>>,
  cwd: string
): { selected: string[]; warnings: DepsExtractionWarning[] } {
  const selected: string[] = [];
  const warnings: DepsExtractionWarning[] = [];

  for (const [root, rootManifests] of npmRoots) {
    const availableLockfiles = NPM_LOCKFILE_PREFERENCE.filter((lockfile) => rootManifests.has(lockfile));
    const preferred = availableLockfiles[0];
    if (availableLockfiles.length > 1 && preferred) {
      const preferredManifest = rootManifests.get(preferred);
      if (preferredManifest) {
        warnings.push(
          depsExtractionWarning(
            preferredManifest,
            "deps.multiple-lockfiles",
            `Multiple lockfiles in ${path.relative(cwd, root) || "."}; using ${preferred} for extraction.`,
            "Standardize on one package manager lockfile per directory."
          )
        );
      }
    }
    if (preferred) {
      const preferredManifest = rootManifests.get(preferred);
      if (preferredManifest) {
        selected.push(preferredManifest);
        continue;
      }
    }

    const packageJson = rootManifests.get("package.json");
    if (packageJson) {
      selected.push(packageJson);
    }
  }

  return { selected, warnings };
}

function selectPythonManifests(
  pythonRoots: Map<string, Map<string, string>>,
  cwd: string
): { selected: string[]; warnings: DepsExtractionWarning[] } {
  const selected: string[] = [];
  const warnings: DepsExtractionWarning[] = [];

  for (const [root, rootManifests] of pythonRoots) {
    const pipfileLock = rootManifests.get("pipfile.lock");
    const pipfile = rootManifests.get("pipfile");
    const uvLock = rootManifests.get("uv.lock");
    const poetryLock = rootManifests.get("poetry.lock");
    const pyproject = rootManifests.get("pyproject.toml");
    const requirements = rootManifests.get("requirements.txt");

    if (pipfileLock) {
      selected.push(pipfileLock);
    } else if (pipfile) {
      selected.push(pipfile);
    }

    if (uvLock && poetryLock) {
      warnings.push(
        depsExtractionWarning(
          uvLock,
          "deps.multiple-lockfiles",
          `Multiple Python lockfiles in ${path.relative(cwd, root) || "."}; using uv.lock for extraction.`,
          "Standardize on one Python lockfile per directory (uv.lock or poetry.lock)."
        )
      );
    }

    if (uvLock) {
      selected.push(uvLock);
    } else if (poetryLock) {
      selected.push(poetryLock);
    } else if (pyproject) {
      selected.push(pyproject);
    }

    if (requirements) {
      selected.push(requirements);
    }
  }

  return { selected, warnings };
}

function selectRubyManifests(
  rubyRoots: Map<string, Map<string, string>>
): { selected: string[]; warnings: DepsExtractionWarning[] } {
  const selected: string[] = [];
  const warnings: DepsExtractionWarning[] = [];

  for (const [root, rootManifests] of rubyRoots) {
    const gemfileLock = rootManifests.get("gemfile.lock");
    const gemfile = rootManifests.get("gemfile");

    if (gemfileLock) {
      selected.push(gemfileLock);
    } else if (gemfile) {
      selected.push(gemfile);
    }
  }

  return { selected, warnings };
}

function selectRustManifests(
  rustRoots: Map<string, Map<string, string>>
): { selected: string[]; warnings: DepsExtractionWarning[] } {
  const selected: string[] = [];
  const warnings: DepsExtractionWarning[] = [];

  for (const [, rootManifests] of rustRoots) {
    const cargoLock = rootManifests.get("cargo.lock");
    const cargoToml = rootManifests.get("cargo.toml");

    if (cargoLock) {
      selected.push(cargoLock);
    } else if (cargoToml) {
      selected.push(cargoToml);
    }
  }

  return { selected, warnings };
}

function selectPhpManifests(
  phpRoots: Map<string, Map<string, string>>
): { selected: string[]; warnings: DepsExtractionWarning[] } {
  const selected: string[] = [];
  const warnings: DepsExtractionWarning[] = [];

  for (const [, rootManifests] of phpRoots) {
    const composerLock = rootManifests.get("composer.lock");
    const composerJson = rootManifests.get("composer.json");

    if (composerLock) {
      selected.push(composerLock);
    } else if (composerJson) {
      selected.push(composerJson);
    }
  }

  return { selected, warnings };
}

function selectSwiftManifests(
  swiftRoots: Map<string, Map<string, string>>
): { selected: string[]; warnings: DepsExtractionWarning[] } {
  const selected: string[] = [];
  const warnings: DepsExtractionWarning[] = [];

  for (const [, rootManifests] of swiftRoots) {
    const resolved = rootManifests.get("package.resolved");
    const packageSwift = rootManifests.get("package.swift");

    if (resolved) {
      selected.push(resolved);
    } else if (packageSwift) {
      selected.push(packageSwift);
    }
  }

  return { selected, warnings };
}

function selectDotnetManifests(
  dotnetRoots: Map<string, { lockfile: string | null; csproj: string | null }>
): { selected: string[]; warnings: DepsExtractionWarning[] } {
  const selected: string[] = [];
  const warnings: DepsExtractionWarning[] = [];

  for (const [, entry] of dotnetRoots) {
    if (entry.lockfile) {
      selected.push(entry.lockfile);
    } else if (entry.csproj) {
      selected.push(entry.csproj);
    }
  }

  return { selected, warnings };
}

function findSiblingLockfilesOnDisk(root: string, lockfileNames: readonly string[]): string[] {
  const found: string[] = [];
  for (const lockfileName of lockfileNames) {
    const candidate = path.join(root, lockfileName);
    if (fs.existsSync(candidate)) {
      found.push(lockfileName);
    }
  }
  return found;
}

function warnUnscopedSiblingLockfiles(
  npmRoots: Map<string, Map<string, string>>,
  pythonRoots: Map<string, Map<string, string>>,
  rubyRoots: Map<string, Map<string, string>>,
  rustRoots: Map<string, Map<string, string>>,
  phpRoots: Map<string, Map<string, string>>,
  swiftRoots: Map<string, Map<string, string>>,
  dotnetRoots: Map<string, { lockfile: string | null; csproj: string | null }>,
  cwd: string
): DepsExtractionWarning[] {
  const warnings: DepsExtractionWarning[] = [];

  for (const [root, rootManifests] of npmRoots) {
    const hasLockfileInScope = NPM_LOCKFILE_PREFERENCE.some((lockfile) => rootManifests.has(lockfile));
    if (hasLockfileInScope || !rootManifests.has("package.json")) {
      continue;
    }

    const lockfilesOnDisk = findSiblingLockfilesOnDisk(root, NPM_LOCKFILE_PREFERENCE);
    if (lockfilesOnDisk.length === 0) {
      continue;
    }

    const packageJson = rootManifests.get("package.json");
    if (!packageJson) {
      continue;
    }

    warnings.push(
      depsExtractionWarning(
        packageJson,
        "deps.lockfile-not-in-scope",
        `Lockfile(s) exist in ${path.relative(cwd, root) || "."} (${lockfilesOnDisk.join(", ")}) but are not in scan scope; ranged package.json entries may be skipped.`,
        "Stage or commit the lockfile, include it in --paths, or scan with --deps-scope tree."
      )
    );
  }

  for (const [root, rootManifests] of pythonRoots) {
    if (rootManifests.has("pipfile") && !rootManifests.has("pipfile.lock")) {
      const lockfilesOnDisk = findSiblingLockfilesOnDisk(root, ["Pipfile.lock"]);
      const pipfile = rootManifests.get("pipfile");
      if (pipfile && lockfilesOnDisk.length > 0) {
        warnings.push(
          depsExtractionWarning(
            pipfile,
            "deps.lockfile-not-in-scope",
            `Pipfile.lock exists in ${path.relative(cwd, root) || "."} but is not in scan scope; ranged Pipfile entries may be skipped.`,
            "Stage or commit Pipfile.lock, include it in --paths, or scan with --deps-scope tree."
          )
        );
      }
    }

    const hasPyprojectLockInScope = rootManifests.has("uv.lock") || rootManifests.has("poetry.lock");
    if (rootManifests.has("pyproject.toml") && !hasPyprojectLockInScope) {
      const lockfilesOnDisk = findSiblingLockfilesOnDisk(root, ["uv.lock", "poetry.lock"]);
      const pyproject = rootManifests.get("pyproject.toml");
      if (pyproject && lockfilesOnDisk.length > 0) {
        warnings.push(
          depsExtractionWarning(
            pyproject,
            "deps.lockfile-not-in-scope",
            `Lockfile(s) exist in ${path.relative(cwd, root) || "."} (${lockfilesOnDisk.join(", ")}) but are not in scan scope; ranged pyproject.toml entries may be skipped.`,
            "Stage or commit uv.lock or poetry.lock, include it in --paths, or scan with --deps-scope tree."
          )
        );
      }
    }
  }

  for (const [root, rootManifests] of rubyRoots) {
    if (rootManifests.has("gemfile") && !rootManifests.has("gemfile.lock")) {
      const lockfilesOnDisk = findSiblingLockfilesOnDisk(root, ["Gemfile.lock"]);
      const gemfile = rootManifests.get("gemfile");
      if (gemfile && lockfilesOnDisk.length > 0) {
        warnings.push(
          depsExtractionWarning(
            gemfile,
            "deps.lockfile-not-in-scope",
            `Gemfile.lock exists in ${path.relative(cwd, root) || "."} but is not in scan scope; ranged Gemfile entries may be skipped.`,
            "Stage or commit Gemfile.lock, include it in --paths, or scan with --deps-scope tree."
          )
        );
      }
    }
  }

  for (const [root, rootManifests] of rustRoots) {
    if (rootManifests.has("cargo.toml") && !rootManifests.has("cargo.lock")) {
      const lockfilesOnDisk = findSiblingLockfilesOnDisk(root, ["Cargo.lock"]);
      const cargoToml = rootManifests.get("cargo.toml");
      if (cargoToml && lockfilesOnDisk.length > 0) {
        warnings.push(
          depsExtractionWarning(
            cargoToml,
            "deps.lockfile-not-in-scope",
            `Cargo.lock exists in ${path.relative(cwd, root) || "."} but is not in scan scope; ranged Cargo.toml entries may be skipped.`,
            "Stage or commit Cargo.lock, include it in --paths, or scan with --deps-scope tree."
          )
        );
      }
    }
  }

  for (const [root, rootManifests] of phpRoots) {
    if (rootManifests.has("composer.json") && !rootManifests.has("composer.lock")) {
      const lockfilesOnDisk = findSiblingLockfilesOnDisk(root, ["composer.lock"]);
      const composerJson = rootManifests.get("composer.json");
      if (composerJson && lockfilesOnDisk.length > 0) {
        warnings.push(
          depsExtractionWarning(
            composerJson,
            "deps.lockfile-not-in-scope",
            `composer.lock exists in ${path.relative(cwd, root) || "."} but is not in scan scope; ranged composer.json entries may be skipped.`,
            "Stage or commit composer.lock, include it in --paths, or scan with --deps-scope tree."
          )
        );
      }
    }
  }

  for (const [root, rootManifests] of swiftRoots) {
    if (rootManifests.has("package.swift") && !rootManifests.has("package.resolved")) {
      const lockfilesOnDisk = findSiblingLockfilesOnDisk(root, ["Package.resolved"]);
      const packageSwift = rootManifests.get("package.swift");
      if (packageSwift && lockfilesOnDisk.length > 0) {
        warnings.push(
          depsExtractionWarning(
            packageSwift,
            "deps.lockfile-not-in-scope",
            `Package.resolved exists in ${path.relative(cwd, root) || "."} but is not in scan scope; ranged Package.swift entries may be skipped.`,
            "Stage or commit Package.resolved, include it in --paths, or scan with --deps-scope tree."
          )
        );
      }
    }
  }

  for (const [root, entry] of dotnetRoots) {
    if (entry.csproj && !entry.lockfile) {
      const lockfilesOnDisk = findSiblingLockfilesOnDisk(root, ["packages.lock.json"]);
      if (lockfilesOnDisk.length > 0) {
        warnings.push(
          depsExtractionWarning(
            entry.csproj,
            "deps.lockfile-not-in-scope",
            `packages.lock.json exists in ${path.relative(cwd, root) || "."} but is not in scan scope; ranged PackageReference entries may be skipped.`,
            "Stage or commit packages.lock.json, include it in --paths, or scan with --deps-scope tree."
          )
        );
      }
    }
  }

  return warnings;
}

function selectDependencyManifests(
  manifests: string[],
  context: ScanContext
): { selected: string[]; warnings: DepsExtractionWarning[] } {
  const npmRoots = groupManifestsByRoot(manifests, context.cwd, NPM_MANIFEST_BASENAMES);
  const pythonRoots = groupManifestsByRoot(manifests, context.cwd, PYTHON_MANIFEST_BASENAMES);
  const rubyRoots = groupManifestsByRoot(manifests, context.cwd, RUBY_MANIFEST_BASENAMES);
  const rustRoots = groupManifestsByRoot(manifests, context.cwd, RUST_MANIFEST_BASENAMES);
  const phpRoots = groupManifestsByRoot(manifests, context.cwd, PHP_MANIFEST_BASENAMES);
  const swiftRoots = groupManifestsByRoot(manifests, context.cwd, SWIFT_MANIFEST_BASENAMES);
  const dotnetRoots = groupDotnetProjectRoots(manifests, context.cwd);
  const groupedBasenames = new Set([
    ...NPM_MANIFEST_BASENAMES,
    ...PYTHON_MANIFEST_BASENAMES,
    ...RUBY_MANIFEST_BASENAMES,
    ...RUST_MANIFEST_BASENAMES,
    ...PHP_MANIFEST_BASENAMES,
    ...SWIFT_MANIFEST_BASENAMES,
    DOTNET_LOCK_BASENAME
  ]);

  const selected: string[] = [];
  for (const manifestPath of manifests) {
    const baseName = path.basename(manifestPath).toLowerCase();
    if (groupedBasenames.has(baseName) || baseName.endsWith(".csproj")) {
      continue;
    }

    selected.push(path.resolve(context.cwd, manifestPath));
  }

  const npmSelection = selectNpmManifests(npmRoots, context.cwd);
  const pythonSelection = selectPythonManifests(pythonRoots, context.cwd);
  const rubySelection = selectRubyManifests(rubyRoots);
  const rustSelection = selectRustManifests(rustRoots);
  const phpSelection = selectPhpManifests(phpRoots);
  const swiftSelection = selectSwiftManifests(swiftRoots);
  const dotnetSelection = selectDotnetManifests(dotnetRoots);
  selected.push(...npmSelection.selected);
  selected.push(...pythonSelection.selected);
  selected.push(...rubySelection.selected);
  selected.push(...rustSelection.selected);
  selected.push(...phpSelection.selected);
  selected.push(...swiftSelection.selected);
  selected.push(...dotnetSelection.selected);
  return {
    selected,
    warnings: [
      ...npmSelection.warnings,
      ...pythonSelection.warnings,
      ...rubySelection.warnings,
      ...rustSelection.warnings,
      ...phpSelection.warnings,
      ...swiftSelection.warnings,
      ...dotnetSelection.warnings,
      ...warnUnscopedSiblingLockfiles(
        npmRoots,
        pythonRoots,
        rubyRoots,
        rustRoots,
        phpRoots,
        swiftRoots,
        dotnetRoots,
        context.cwd
      )
    ]
  };
}

export interface DependencyCollectionResult {
  dependencies: DependencyCoordinate[];
  warnings: DepsExtractionWarning[];
}

export function collectDependencies(context: ScanContext, manifests: string[]): DependencyCollectionResult {
  const { selected: selectedManifests, warnings } = selectDependencyManifests(manifests, context);
  const all: DependencyCoordinate[] = [];

  for (const manifestPath of selectedManifests) {
    const result = extractDependenciesForManifestWithDiagnostics(manifestPath);
    warnings.push(...result.warnings);
    all.push(...result.dependencies);
  }

  const seen = new Set<string>();
  const deduped: DependencyCoordinate[] = [];
  for (const dep of all) {
    const key = `${dep.ecosystem}:${dep.name}:${dep.version}:${dep.manifestPath}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(dep);
    }
  }
  return { dependencies: deduped, warnings: filterRedundantLockfileWarnings(warnings) };
}

function filterRedundantLockfileWarnings(warnings: DepsExtractionWarning[]): DepsExtractionWarning[] {
  const lockfileWarningPaths = new Set(
    warnings
      .filter((warning) => warning.code === "deps.lockfile-not-in-scope")
      .map((warning) => warning.manifestPath)
  );
  if (lockfileWarningPaths.size === 0) {
    return warnings;
  }

  return warnings.filter(
    (warning) =>
      warning.code !== "deps.non-exact-spec" || !lockfileWarningPaths.has(warning.manifestPath)
  );
}

function resolveDepsManifests(context: ScanContext): string[] {
  if (context.depsManifestPaths !== null) {
    return context.depsManifestPaths;
  }

  const manifests = filterDependencyManifests(context.files);
  // Git-based scans honor git_ignored_prefixes (for example examples/).
  // Explicit --paths and --deps-scope tree keep those fixtures scannable.
  if (context.explicitPaths) {
    return manifests;
  }

  return manifests.filter(
    (manifestPath) => !isIgnoredScanPath(manifestPath, context.cwd, context.options.gitIgnoredPrefixes)
  );
}

export const depsAspect: ScanAspect = {
  id: "deps",
  label: "Dependency vulnerability checks",
  async run(context: ScanContext): Promise<AspectOutcome> {
    const manifests = resolveDepsManifests(context);
    if (manifests.length === 0) {
      const message =
        context.depsManifestPaths !== null
          ? "No dependency manifests found under scan roots."
          : "No dependency manifests changed.";
      return {
        aspect: "deps",
        status: "skipped",
        exitCode: 0,
        message
      };
    }

    const { dependencies, warnings } = collectDependencies(context, manifests);
    printScanWarnings("deps", warnings, context.options.outputFormat, context.cwd, context.options);
    if (dependencies.length === 0) {
      return {
        aspect: "deps",
        status: "skipped",
        exitCode: 0,
        message: buildDepsSkipMessage(manifests)
      };
    }

    try {
      const providerUrl = resolveDepsProviderUrl(context.options.deps);
      const cached = readDepsCache(context.cwd, providerUrl, dependencies, context.options.deps);
      let findings: DepsFinding[];

      if (!context.options.deps.refresh && cached && isDepsCacheFresh(cached, context.options.deps.cacheTtlMs)) {
        findings = cached.findings;
      } else {
        findings = await queryDependencies(dependencies, context.options.deps);
        writeDepsCache(context.cwd, providerUrl, dependencies, context.options.deps, findings);
      }

      if (findings.length === 0) {
        writeScanStatus(
          `[deps] No vulnerabilities across ${dependencies.length} dependency version(s) from ${manifests.length} manifest file(s).`,
          context.options
        );
        return { aspect: "deps", status: "ok", exitCode: 0 };
      }

      const unified: Finding[] = findings.map((depFinding) => ({
        ruleId: DEPS_FINDING_RULE_ID,
        message: depFinding.summary,
        filePath: depFinding.manifestPath,
        line: depFinding.manifestLine,
        severity: depFinding.severity,
        packageName: depFinding.packageName,
        packageVersion: depFinding.version,
        advisoryId: depFinding.advisoryId,
        cveId: depFinding.cveId ?? undefined,
        fixedVersion: depFinding.fixedVersion ?? undefined,
        evidence: depFinding.cveId ?? depFinding.advisoryId,
        remediation: depFinding.remediation,
        kind: "dependency"
      }));

      const packageCount = new Set(unified.map((finding) => `${finding.packageName}@${finding.packageVersion}`)).size;
      writeScanLog(
        `[deps] ${findings.length} advisory finding(s) across ${packageCount} vulnerable package version(s) from ${manifests.length} manifest file(s):`,
        context.options
      );
      printUnifiedFindings("deps", unified, context.options.outputFormat, context.cwd);
      return {
        aspect: "deps",
        status: "failed",
        exitCode: 1,
        message: `${findings.length} vulnerable dependency finding(s)`
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        aspect: "deps",
        status: "failed",
        exitCode: 1,
        message: `Dependency provider error: ${message}`
      };
    }
  }
};