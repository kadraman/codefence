import path from "node:path";
import { filterDependencyManifests } from "../../manifests";
import type { Finding } from "../../types";
import { AspectOutcome, ScanAspect, ScanContext } from "../types";
import { isDepsCacheFresh, readDepsCache, writeDepsCache } from "../deps/cache";
import { resolveDepsProviderUrl } from "../deps/config";
import { extractDependenciesForManifest } from "../deps/extract";
import { queryDependencies } from "../deps/query";
import { DepsFinding, DependencyCoordinate, DEPS_FINDING_RULE_ID } from "../deps/types";
import { printUnifiedFindings, writeScanLog, writeScanStatus } from "../output";

function collectDependencies(context: ScanContext, manifests: string[]): DependencyCoordinate[] {
  const all: DependencyCoordinate[] = [];
  for (const manifestPath of manifests) {
    const absolute = path.resolve(context.cwd, manifestPath);
    all.push(...extractDependenciesForManifest(absolute));
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

