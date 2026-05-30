import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { extractDependenciesForManifest, extractPackageJsonDependencies } from "../src/scan/deps/extract";
import { queryOsvForDependencies } from "../src/scan/deps/provider";

const FIXTURE_ROOT = path.join(process.cwd(), "examples", "deps", "npm");
const PYTHON_FIXTURE_ROOT = path.join(process.cwd(), "examples", "deps", "python");
const OSV_RUNTIME_APP_BATCH = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "osv-runtime-app-batch.json"
);

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
    "PyPI:urllib3@1.26.4"
  ]);
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
