import path from "node:path";
import { filterDependencyManifests } from "../../manifests";
import { AspectOutcome, ScanAspect, ScanContext } from "../types";
import { isDepsCacheFresh, readDepsCache, writeDepsCache } from "../deps/cache";
import { resolveDepsProviderUrl } from "../deps/config";
import { extractDependenciesForManifest } from "../deps/extract";
import { queryOsvForDependencies } from "../deps/provider";
import { DepsFinding, DependencyCoordinate } from "../deps/types";

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

function printFindings(findings: DepsFinding[]): void {
  console.error(`[deps] ${findings.length} finding(s):`);
  for (const finding of findings) {
    const filePath = path.relative(process.cwd(), finding.manifestPath).replace(/\\/g, "/");
    console.error(`  ${finding.severity.toUpperCase()} vulnerable-dependency file=${filePath}`);
    console.error(
      `    package=${finding.packageName} version=${finding.version} advisory=${finding.advisoryId}`
    );
    console.error(`    message=${finding.summary}`);
    console.error(`    remediation=${finding.remediation}`);
  }
}

export const depsAspect: ScanAspect = {
  id: "deps",
  label: "Dependency vulnerability checks",
  async run(context: ScanContext): Promise<AspectOutcome> {
    const manifests = filterDependencyManifests(context.files);
    if (manifests.length === 0) {
      return {
        aspect: "deps",
        status: "skipped",
        exitCode: 0,
        message: "No dependency manifests changed."
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
        findings = await queryOsvForDependencies(dependencies, {
          providerUrl,
          timeoutMs: context.options.deps.timeoutMs
        });
        writeDepsCache(context.cwd, providerUrl, dependencies, context.options.deps, findings);
      }

      if (findings.length === 0) {
        console.log(
          `[deps] No vulnerabilities across ${dependencies.length} dependency version(s) from ${manifests.length} manifest file(s).`
        );
        return { aspect: "deps", status: "ok", exitCode: 0 };
      }

      printFindings(findings);
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

