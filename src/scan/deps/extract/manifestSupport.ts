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

export function manifestBasenameHasExtractor(filePath: string): boolean {
  return EXTRACTOR_MANIFEST_BASENAMES.has(manifestBasename(filePath));
}

export function buildDepsSkipMessage(manifestPaths: string[]): string {
  const basenames = manifestPaths.map((manifestPath) => path.basename(manifestPath));
  const withoutExtractor = [
    ...new Set(basenames.filter((baseName) => !EXTRACTOR_MANIFEST_BASENAMES.has(baseName.toLowerCase())))
  ];
  const withExtractor = basenames.filter((baseName) =>
    EXTRACTOR_MANIFEST_BASENAMES.has(baseName.toLowerCase())
  );

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
