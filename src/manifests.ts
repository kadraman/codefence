export const dependencyManifestNames = new Set([
  "package.json",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "build.gradle",
  "build.gradle.kts",
  "pom.xml",
  "requirements.txt",
  "Pipfile",
  "poetry.lock",
  "go.mod",
  "go.sum",
  "Cargo.toml",
  "Cargo.lock",
  "Gemfile",
  "Gemfile.lock",
  "composer.json",
  "packages.config",
  "Package.swift"
]);

/** @deprecated Use dependencyManifestNames */
export const dependencyFiles = dependencyManifestNames;

export function manifestBaseName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.split("/").pop() ?? normalized;
}

export function isDependencyManifest(filePath: string): boolean {
  const baseName = manifestBaseName(filePath);
  if (dependencyManifestNames.has(baseName)) {
    return true;
  }

  const lowered = baseName.toLowerCase();
  return lowered.endsWith(".sln") || lowered.endsWith(".csproj");
}

export function filterDependencyManifests(files: string[]): string[] {
  return files.filter(isDependencyManifest);
}

export function hasDependencyFileChanges(files: string[]): boolean {
  return filterDependencyManifests(files).length > 0;
}
