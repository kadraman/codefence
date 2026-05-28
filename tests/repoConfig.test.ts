import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadRepoScanDefaults } from "../src/scan/repoConfig";

test("loadRepoScanDefaults uses built-in defaults when no file exists", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-config-defaults-"));
  try {
    const config = loadRepoScanDefaults(dir);
    assert.deepEqual(config.aspects, ["code"]);
    assert.deepEqual(config.gitIgnoredPrefixes, ["examples/"]);
    assert.equal(config.deps.scope, "changed");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("loadRepoScanDefaults parses yaml values", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-config-yaml-"));
  fs.writeFileSync(
    path.join(dir, "codefence-config.yml"),
    `version: 1
scan:
  aspects: [deps]
  format: json
  quiet: true
paths:
  git_ignored_prefixes:
    - fixtures/
deps:
  scope: tree
  http2: on
secret:
  min_confidence: medium
`,
    "utf8"
  );
  try {
    const config = loadRepoScanDefaults(dir);
    assert.deepEqual(config.aspects, ["deps"]);
    assert.equal(config.format, "json");
    assert.equal(config.quiet, true);
    assert.deepEqual(config.gitIgnoredPrefixes, ["fixtures/"]);
    assert.equal(config.deps.scope, "tree");
    assert.equal(config.deps.http2Mode, "on");
    assert.equal(config.secret.minConfidence, "medium");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("loadRepoScanDefaults rejects invalid config version", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-config-invalid-"));
  fs.writeFileSync(path.join(dir, "codefence-config.yml"), "version: 2\n", "utf8");
  try {
    assert.throws(() => loadRepoScanDefaults(dir), /version must be 1/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
