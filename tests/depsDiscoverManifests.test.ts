import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { discoverDependencyManifests } from "../src/scan/deps/discoverManifests";
import { buildScanContext } from "../src/scan/runner";
import { defaultDepsScanOptions } from "../src/scan/deps/config";
import { defaultSecretScanOptions } from "../src/scan/secret/config";
import { resolveAspects } from "../src/scan/parseOptions";

test("discoverDependencyManifests finds npm manifests and skips node_modules", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-deps-tree-"));
  const appDir = path.join(root, "apps", "web");
  fs.mkdirSync(path.join(appDir, "node_modules", "lodash"), { recursive: true });
  fs.writeFileSync(path.join(appDir, "package.json"), '{"dependencies":{"lodash":"4.17.20"}}');
  fs.writeFileSync(path.join(appDir, "yarn.lock"), '# yarn lockfile v1\n');
  fs.writeFileSync(path.join(appDir, "node_modules", "lodash", "package.json"), "{}");

  const manifests = discoverDependencyManifests(root);
  assert.deepEqual(manifests, ["apps/web/package.json", "apps/web/yarn.lock"]);
});

test("discoverDependencyManifests limits walk to explicit roots", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-deps-roots-"));
  fs.mkdirSync(path.join(root, "a"), { recursive: true });
  fs.mkdirSync(path.join(root, "b"), { recursive: true });
  fs.writeFileSync(path.join(root, "a", "package.json"), "{}");
  fs.writeFileSync(path.join(root, "b", "package.json"), "{}");

  assert.deepEqual(discoverDependencyManifests(root, ["a"]), ["a/package.json"]);
});

test("buildScanContext populates depsManifestPaths for tree scope", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-deps-ctx-"));
  fs.writeFileSync(path.join(root, "package.json"), '{"dependencies":{"lodash":"4.17.20"}}');

  const previous = process.cwd();
  process.chdir(root);
  try {
    const context = buildScanContext({
      staged: false,
      paths: [],
      gitIgnoredPrefixes: ["examples/"],
      defaultAspects: ["code"],
      only: ["deps"],
      skip: [],
      secret: defaultSecretScanOptions(),
      deps: { ...defaultDepsScanOptions(), scope: "tree" },
      outputFormat: "table",
      quiet: false,
      verbose: false
    });
    assert.ok(context.depsManifestPaths);
    assert.deepEqual(context.depsManifestPaths, ["package.json"]);
  } finally {
    process.chdir(previous);
  }
});

test("resolveAspects auto-includes deps when deps scope is tree", () => {
  const aspects = resolveAspects(
    {
      staged: false,
      paths: [],
      gitIgnoredPrefixes: ["examples/"],
      defaultAspects: ["code"],
      only: null,
      skip: [],
      secret: defaultSecretScanOptions(),
      deps: { ...defaultDepsScanOptions(), scope: "tree" },
      outputFormat: "table",
      quiet: false,
      verbose: false
    },
    []
  );
  assert.deepEqual(aspects, ["code", "deps"]);
});
