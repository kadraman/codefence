import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { collectDependencies } from "../src/scan/aspects/deps";
import { defaultDepsScanOptions } from "../src/scan/deps/config";
import { extractDependenciesForManifest, extractPackageJsonDependencies } from "../src/scan/deps/extract";
import { queryOsvForDependencies } from "../src/scan/deps/provider";
import { defaultSecretScanOptions } from "../src/scan/secret/config";
import { ScanContext } from "../src/scan/types";

const FIXTURE_ROOT = path.join(process.cwd(), "examples", "deps", "npm");
const PYTHON_FIXTURE_ROOT = path.join(process.cwd(), "examples", "deps", "python");
const OSV_RUNTIME_APP_BATCH = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "osv-runtime-app-batch.json"
);

function makeExampleContext(cwd: string): ScanContext {
  return {
    cwd,
    files: [],
    staged: false,
    explicitPaths: true,
    depsManifestPaths: null,
    options: {
      staged: false,
      paths: [],
      gitIgnoredPrefixes: ["examples/"],
      defaultAspects: ["code"],
      only: ["deps"],
      skip: [],
      secret: defaultSecretScanOptions(),
      deps: defaultDepsScanOptions(),
      outputFormat: "json",
      quiet: true,
      verbose: false
    }
  };
}

test("examples deps fixtures expose exact npm coordinates", () => {
  const manifests = [
    path.join(FIXTURE_ROOT, "runtime-app", "package.json"),
    path.join(FIXTURE_ROOT, "dev-tooling", "package.json"),
    path.join(FIXTURE_ROOT, "library", "package.json")
  ];

  const coordinates = manifests.flatMap((manifestPath) => extractPackageJsonDependencies(manifestPath));
  const labels = coordinates.map((dep) => `${dep.name}@${dep.version}`).sort();

  assert.deepEqual(labels, [
    "jsonwebtoken@8.5.1",
    "lodash@4.17.20",
    "minimist@1.2.5",
    "node-fetch@2.6.0",
    "ws@7.3.0"
  ]);
});

test("examples deps lockfile fixtures expose the same npm coordinates", () => {
  const manifests = [
    path.join(FIXTURE_ROOT, "runtime-app", "package-lock.json"),
    path.join(FIXTURE_ROOT, "dev-tooling", "package-lock.json"),
    path.join(FIXTURE_ROOT, "library", "package-lock.json")
  ];

  const coordinates = manifests.flatMap((manifestPath) => extractDependenciesForManifest(manifestPath));
  const labels = coordinates.map((dep) => `${dep.name}@${dep.version}`).sort();

  assert.deepEqual(labels, [
    "jsonwebtoken@8.5.1",
    "lodash@4.17.20",
    "minimist@1.2.5",
    "node-fetch@2.6.0",
    "ws@7.3.0"
  ]);
});

test("examples python deps fixtures expose exact PyPI coordinates", () => {
  const manifests = [
    path.join(PYTHON_FIXTURE_ROOT, "requirements-app", "requirements.txt"),
    path.join(PYTHON_FIXTURE_ROOT, "pipfile-app", "Pipfile"),
    path.join(PYTHON_FIXTURE_ROOT, "pyproject-app", "pyproject.toml")
  ];

  const coordinates = manifests.flatMap((manifestPath) => extractDependenciesForManifest(manifestPath));
  const labels = coordinates.map((dep) => `${dep.ecosystem}:${dep.name}@${dep.version}`).sort();

  assert.deepEqual(labels, [
    "PyPI:django@2.2.24",
    "PyPI:jinja2@2.11.2",
    "PyPI:pytest@7.4.0",
    "PyPI:urllib3@1.26.4"
  ]);
});

test("examples python lockfile fixtures expose resolved PyPI coordinates", () => {
  const repoRoot = process.cwd();
  const pipfileApp = path.join(PYTHON_FIXTURE_ROOT, "pipfile-app");
  const pyprojectApp = path.join(PYTHON_FIXTURE_ROOT, "pyproject-app");

  const pipfileDeps = collectDependencies(makeExampleContext(repoRoot), [
    path.relative(repoRoot, path.join(pipfileApp, "Pipfile")),
    path.relative(repoRoot, path.join(pipfileApp, "Pipfile.lock"))
  ]).dependencies;
  const pyprojectDeps = collectDependencies(makeExampleContext(repoRoot), [
    path.relative(repoRoot, path.join(pyprojectApp, "pyproject.toml")),
    path.relative(repoRoot, path.join(pyprojectApp, "poetry.lock"))
  ]).dependencies;

  assert.deepEqual(
    pipfileDeps.map((dep) => `${dep.ecosystem}:${dep.name}@${dep.version}`).sort(),
    ["PyPI:click@8.1.7", "PyPI:jinja2@2.11.2"]
  );
  assert.ok(pipfileDeps.every((dep) => dep.manifestPath.endsWith("Pipfile.lock")));

  assert.deepEqual(
    pyprojectDeps.map((dep) => `${dep.ecosystem}:${dep.name}@${dep.version}`).sort(),
    ["PyPI:requests@2.31.0", "PyPI:urllib3@1.26.4"]
  );
  assert.ok(pyprojectDeps.every((dep) => dep.manifestPath.endsWith("poetry.lock")));

  const uvApp = path.join(PYTHON_FIXTURE_ROOT, "uv-app");
  const uvDeps = collectDependencies(makeExampleContext(repoRoot), [
    path.relative(repoRoot, path.join(uvApp, "pyproject.toml")),
    path.relative(repoRoot, path.join(uvApp, "uv.lock"))
  ]).dependencies;

  assert.deepEqual(
    uvDeps.map((dep) => `${dep.ecosystem}:${dep.name}@${dep.version}`).sort(),
    [
      "PyPI:certifi@2024.7.4",
      "PyPI:charset-normalizer@3.3.2",
      "PyPI:idna@3.7.0",
      "PyPI:requests@2.31.0",
      "PyPI:urllib3@1.26.4"
    ]
  );
  assert.ok(uvDeps.every((dep) => dep.manifestPath.endsWith("uv.lock")));
});

test("examples deps fixtures normalize stubbed OSV batch into findings with CVE ids", async () => {
  const manifestPath = path.join(FIXTURE_ROOT, "runtime-app", "package-lock.json");
  const coordinates = extractDependenciesForManifest(manifestPath);
  const batchResponse = JSON.parse(fs.readFileSync(OSV_RUNTIME_APP_BATCH, "utf8"));

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    assert.match(url, /\/querybatch$/);
    return {
      ok: true,
      json: async () => batchResponse
    } as Response;
  }) as typeof fetch;

  try {
    const findings = await queryOsvForDependencies(coordinates, {
      providerUrl: "https://api.osv.dev/v1/querybatch",
      timeoutMs: 1000,
      http2Mode: "auto"
    });

    assert.equal(findings.length, 2);
    const lodash = findings.find((finding) => finding.packageName === "lodash" && finding.version === "4.17.20");
    const minimist = findings.find((finding) => finding.packageName === "minimist" && finding.version === "1.2.5");
    assert.ok(lodash);
    assert.ok(minimist);
    assert.equal(lodash.severity, "high");
    assert.equal(minimist.severity, "critical");
    assert.ok(findings.every((finding) => finding.cveId?.startsWith("CVE-")));
    assert.ok(coordinates.every((coordinate) => coordinate.manifestLine > 0));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
