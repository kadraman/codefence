import path from "node:path";

/** Manifest basenames with a dependency extractor in `extract.ts`. */
export const EXTRACTOR_MANIFEST_BASENAMES = new Set([
  "package.json",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "requirements.txt",
  "pipfile",
  "pipfile.lock",
  "pyproject.toml",
  "poetry.lock",
  "uv.lock",
  "go.mod",
  "gemfile",
  "gemfile.lock",
  "composer.json"
]);

export function manifestBasename(filePath: string): string {
  return path.basename(filePath).toLowerCase();
}

export function isExtractorSupportedManifest(filePath: string): boolean {
  const baseName = manifestBasename(filePath);
  if (EXTRACTOR_MANIFEST_BASENAMES.has(baseName)) {
    return true;
  }
  return baseName.endsWith(".csproj");
}

export function manifestBasenameHasExtractor(filePath: string): boolean {
  return isExtractorSupportedManifest(filePath);
}

export function buildDepsSkipMessage(manifestPaths: string[]): string {
  const withoutExtractor = [
    ...new Set(
      manifestPaths
        .filter((manifestPath) => !isExtractorSupportedManifest(manifestPath))
        .map((manifestPath) => path.basename(manifestPath))
    )
  ];
  const withExtractor = manifestPaths.filter((manifestPath) => isExtractorSupportedManifest(manifestPath));

  if (withoutExtractor.length > 0 && withExtractor.length === 0) {
    return `No dependency extractor for: ${withoutExtractor.join(", ")}. See docs/dependency-support.md.`;
  }

  if (withoutExtractor.length > 0) {
    return (
      `No exact-version dependencies extracted from changed manifests. ` +
      `No extractor yet for: ${withoutExtractor.join(", ")}.`
    );
  }

  return "No exact-version dependencies extracted from changed manifests.";
}
