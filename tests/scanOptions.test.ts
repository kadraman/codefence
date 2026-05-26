import assert from "node:assert/strict";
import test from "node:test";
import { parseAspectList, parseScanArgv, resolveAspects } from "../src/scan/parseOptions";
import { defaultDepsScanOptions } from "../src/scan/deps/config";
import { BUILTIN_SECRET_RULES_VERSION } from "../src/scan/secret/types";

test("parseScanArgv errors when value-taking flags are missing a value", () => {
  assert.throws(() => parseScanArgv(["--only"]), /--only requires a value/);
  assert.throws(() => parseScanArgv(["--only", "--staged"]), /--only requires a value/);
  assert.throws(() => parseScanArgv(["--only="]), /--only requires a value/);
  assert.throws(() => parseScanArgv(["--skip"]), /--skip requires a value/);
  assert.throws(() => parseScanArgv(["--skip", "-h"]), /--skip requires a value/);
  assert.throws(() => parseScanArgv(["--secret-rules"]), /--secret-rules requires at least one value/);
});

test("parseScanArgv recognizes -h and --help", () => {
  assert.deepEqual(parseScanArgv(["-h"]), { help: true });
  assert.deepEqual(parseScanArgv(["--help"]), { help: true });
  assert.deepEqual(parseScanArgv(["--staged", "-h"]), { help: true });
});

test("parseAspectList accepts code only", () => {
  assert.deepEqual(parseAspectList("code"), ["code"]);
  assert.deepEqual(parseAspectList("deps"), ["deps"]);
});

test("resolveAspects defaults to code and deps", () => {
  const aspects = resolveAspects({
    staged: false,
    paths: [],
    only: null,
    skip: [],
    secret: {
      rulePaths: [],
      defaultRules: true,
      defaultRulesVersion: null,
      rulesUpdateUrl: null,
      rulesRefresh: false,
      rulesCacheTtlMs: 86400000,
      entropyThreshold: 4.2,
      minLength: 12,
      minConfidence: "low"
    },
    deps: defaultDepsScanOptions(),
    outputFormat: "table"
  });
  assert.deepEqual(aspects, ["code", "deps"]);
});

test("resolveAspects honors --only and --skip", () => {
  const aspects = resolveAspects({
    staged: false,
    paths: [],
    only: ["code"],
    skip: ["code"],
    secret: {
      rulePaths: [],
      defaultRules: true,
      defaultRulesVersion: null,
      rulesUpdateUrl: null,
      rulesRefresh: false,
      rulesCacheTtlMs: 86400000,
      entropyThreshold: 4.2,
      minLength: 12,
      minConfidence: "low"
    },
    deps: defaultDepsScanOptions(),
    outputFormat: "table"
  });
  assert.deepEqual(aspects, []);
});

test("parseScanArgv parses dependency scanning flags", () => {
  const parsed = parseScanArgv([
    "--deps-provider",
    "custom",
    "--deps-provider-url",
    "https://example.test/v1/querybatch",
    "--deps-refresh",
    "--deps-cache-ttl",
    "12h",
    "--deps-timeout",
    "45s",
    "--deps-http2",
    "on"
  ]);

  assert.ok(!("help" in parsed));
  assert.equal(parsed.deps.provider, "custom");
  assert.equal(parsed.deps.providerUrl, "https://example.test/v1/querybatch");
  assert.equal(parsed.deps.refresh, true);
  assert.equal(parsed.deps.cacheTtlMs, 12 * 60 * 60 * 1000);
  assert.equal(parsed.deps.timeoutMs, 45 * 1000);
  assert.equal(parsed.deps.http2Mode, "on");
});

test("parseScanArgv parses secret engine flags", () => {
  const parsed = parseScanArgv([
    "--staged",
    "--secret-rules",
    "rules/a.yml",
    "rules/b.yaml",
    "--secret-default-rules-version",
    BUILTIN_SECRET_RULES_VERSION,
    "--secret-rules-update-url",
    "https://example.com/rules.yml",
    "--secret-rules-refresh",
    "--secret-rules-cache-ttl",
    "12h",
    "--secret-entropy-threshold",
    "4.5",
    "--secret-min-length",
    "18",
    "--secret-min-confidence",
    "medium"
  ]);

  assert.ok(!("help" in parsed));
  assert.deepEqual(parsed.secret.rulePaths, ["rules/a.yml", "rules/b.yaml"]);
  assert.equal(parsed.secret.defaultRulesVersion, BUILTIN_SECRET_RULES_VERSION);
  assert.equal(parsed.secret.rulesUpdateUrl, "https://example.com/rules.yml");
  assert.equal(parsed.secret.rulesRefresh, true);
  assert.equal(parsed.secret.rulesCacheTtlMs, 12 * 60 * 60 * 1000);
  assert.equal(parsed.secret.entropyThreshold, 4.5);
  assert.equal(parsed.secret.minLength, 18);
  assert.equal(parsed.secret.minConfidence, "medium");
});
