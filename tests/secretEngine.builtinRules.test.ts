import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  BUILTIN_SECRET_RULES_BUNDLE,
  loadBuiltinSecretRules,
  resolveBuiltinRulesBundlePath
} from "../src/scan/secret/builtinRules";
import { loadSecretRules } from "../src/scan/secret/ruleLoader";
import { BUILTIN_SECRET_RULES_VERSION } from "../src/scan/secret/types";

const EXPECTED_BUILTIN_RULE_IDS = [
  "secret-github-token",
  "secret-gitlab-token",
  "secret-stripe-key",
  "secret-bearer-token",
  "secret-private-key",
  "secret-password-assignment",
  "secret-uri-credentials",
  "no-hardcoded-secret"
];

test("built-in rules load from bundled Semgrep-style YAML", () => {
  const bundlePath = resolveBuiltinRulesBundlePath();
  assert.ok(bundlePath.endsWith("builtin.yml"));
  assert.ok(fs.existsSync(bundlePath));

  const rules = loadBuiltinSecretRules();
  assert.equal(rules.length, EXPECTED_BUILTIN_RULE_IDS.length);
  assert.deepEqual(
    rules.map((rule) => rule.id).sort(),
    [...EXPECTED_BUILTIN_RULE_IDS].sort()
  );
  assert.ok(rules.every((rule) => rule.source === "builtin"));
  assert.ok(rules.every((rule) => rule.sourceName === `builtin@${BUILTIN_SECRET_RULES_VERSION}`));
  assert.ok(rules.every((rule) => rule.patterns.length > 0));
});

test("loadSecretRules uses YAML built-ins when default rules are enabled", async () => {
  const rules = await loadSecretRules(process.cwd(), {
    rulePaths: [],
    defaultRules: true,
    defaultRulesVersion: null,
    rulesUpdateUrl: null,
    rulesRefresh: false,
    rulesCacheTtlMs: 1000,
    entropyThreshold: 4.2,
    minLength: 12,
    minConfidence: "low"
  });

  assert.equal(rules.length, EXPECTED_BUILTIN_RULE_IDS.length);
});
