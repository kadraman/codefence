import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { extractPackageJsonDependencies } from "../src/scan/deps/extract";
import { queryOsvForDependencies } from "../src/scan/deps/provider";

const FIXTURE_ROOT = path.join(process.cwd(), "examples", "deps", "npm");

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

test("examples deps fixtures return OSV findings with CVE ids for pinned vulnerable versions", async () => {
  const manifestPath = path.join(FIXTURE_ROOT, "runtime-app", "package.json");
  const coordinates = extractPackageJsonDependencies(manifestPath);

  const findings = await queryOsvForDependencies(coordinates, {
    providerUrl: "https://api.osv.dev/v1/querybatch",
    timeoutMs: 15_000
  });

  assert.ok(findings.length > 0);
  assert.ok(findings.some((finding) => finding.packageName === "lodash" && finding.version === "4.17.20"));
  assert.ok(findings.some((finding) => finding.packageName === "minimist" && finding.version === "1.2.5"));
  assert.ok(findings.some((finding) => finding.cveId?.startsWith("CVE-")));
  assert.ok(coordinates.every((coordinate) => coordinate.manifestLine > 0));
});
