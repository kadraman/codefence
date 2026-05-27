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

test("resolveAspects defaults to code", () => {
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
    outputFormat: "table",
    quiet: false,
    verbose: false
  });
  assert.deepEqual(aspects, ["code"]);
});

test("resolveAspects adds deps when dependency manifests are in scope", () => {
  const baseOptions = {
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
      minConfidence: "low" as const
    },
    deps: defaultDepsScanOptions(),
    outputFormat: "table" as const,
    quiet: false,
    verbose: false
  };

  assert.deepEqual(resolveAspects(baseOptions, ["src/app.ts"]), ["code"]);
  assert.deepEqual(resolveAspects(baseOptions, ["package.json"]), ["code", "deps"]);
  assert.deepEqual(resolveAspects(baseOptions, ["src/app.ts", "package-lock.json"]), ["code", "deps"]);
});

test("resolveAspects does not auto-add deps when --only code is set", () => {
  const aspects = resolveAspects(
    {
      staged: false,
      paths: [],
      only: ["code"],
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
      outputFormat: "table",
    quiet: false,
    verbose: false
    },
    ["package.json"]
  );
  assert.deepEqual(aspects, ["code"]);
});

test("resolveAspects does not auto-add deps when --skip deps is set", () => {
  const aspects = resolveAspects(
    {
      staged: false,
      paths: [],
      only: null,
      skip: ["deps"],
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
      outputFormat: "table",
    quiet: false,
    verbose: false
    },
    ["package.json"]
  );
  assert.deepEqual(aspects, ["code"]);
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
    outputFormat: "table",
    quiet: false,
    verbose: false
  });
  assert.deepEqual(aspects, []);
});

test("parseScanArgv enables quiet json output by default and verbose override", () => {
  const jsonDefault = parseScanArgv(["--format", "json"]);
  assert.ok(!("help" in jsonDefault));
  assert.equal(jsonDefault.outputFormat, "json");
  assert.equal(jsonDefault.quiet, false);
  assert.equal(jsonDefault.verbose, false);

  const jsonVerbose = parseScanArgv(["--format", "json", "--verbose"]);
  assert.ok(!("help" in jsonVerbose));
  assert.equal(jsonVerbose.verbose, true);

  const tableQuiet = parseScanArgv(["--quiet"]);
  assert.ok(!("help" in tableQuiet));
  assert.equal(tableQuiet.quiet, true);
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

test("parseScanArgv parses --deps-scope tree", () => {
  const parsed = parseScanArgv(["--deps-scope", "tree", "--only", "deps"]);
  assert.ok(!("help" in parsed));
  assert.equal(parsed.deps.scope, "tree");
  assert.throws(() => parseScanArgv(["--deps-scope", "all"]), /--deps-scope must be changed or tree/);
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
