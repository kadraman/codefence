import path from "node:path";
import { filterDependencyManifests } from "../../manifests";
import type { Finding } from "../../types";
import { AspectOutcome, ScanAspect, ScanContext } from "../types";
import { isDepsCacheFresh, readDepsCache, writeDepsCache } from "../deps/cache";
import { resolveDepsProviderUrl } from "../deps/config";
import { extractDependenciesForManifestWithDiagnostics } from "../deps/extract";
import { queryDependencies } from "../deps/query";
import { DepsFinding, DependencyCoordinate, DEPS_FINDING_RULE_ID } from "../deps/types";
import { printUnifiedFindings, writeScanLog, writeScanStatus } from "../output";

const LOCKFILE_PREFERENCE = ["pnpm-lock.yaml", "package-lock.json", "yarn.lock"] as const;
const NPM_MANIFEST_BASENAMES = new Set(["package.json", ...LOCKFILE_PREFERENCE]);

function selectDependencyManifests(manifests: string[], context: ScanContext): string[] {
  const selected: string[] = [];
  const npmRoots = new Map<string, Map<string, string>>();

  for (const manifestPath of manifests) {
    const absolute = path.resolve(context.cwd, manifestPath);
    const baseName = path.basename(manifestPath).toLowerCase();
    if (!NPM_MANIFEST_BASENAMES.has(baseName)) {
      selected.push(absolute);
      continue;
    }

    const root = path.dirname(absolute);
    const rootManifests = npmRoots.get(root) ?? new Map<string, string>();
    rootManifests.set(baseName, absolute);
    npmRoots.set(root, rootManifests);
  }

  for (const [root, rootManifests] of npmRoots) {
    const availableLockfiles = LOCKFILE_PREFERENCE.filter((lockfile) => rootManifests.has(lockfile));
    const preferred = availableLockfiles[0];
    if (availableLockfiles.length > 1 && preferred) {
      writeScanLog(
        `[deps] Warning: multiple lockfiles in ${path.relative(context.cwd, root) || "."}; using ${preferred} for extraction.`,
        context.options
      );
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

  return selected;
}

export function collectDependencies(context: ScanContext, manifests: string[]): DependencyCoordinate[] {
  const selectedManifests = selectDependencyManifests(manifests, context);
  const all: DependencyCoordinate[] = [];

  for (const manifestPath of selectedManifests) {
    const result = extractDependenciesForManifestWithDiagnostics(manifestPath);
    for (const warning of result.warnings) {
      writeScanLog(`[deps] Warning: ${warning}`, context.options);
    }
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
  return deduped;
}

function resolveDepsManifests(context: ScanContext): string[] {
  if (context.depsManifestPaths !== null) {
    return context.depsManifestPaths;
  }
  return filterDependencyManifests(context.files);
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

    const dependencies = collectDependencies(context, manifests);
    if (dependencies.length === 0) {
      return {
        aspect: "deps",
        status: "skipped",
        exitCode: 0,
        message: "No exact-version dependencies extracted from changed manifests."
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
