import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadSecretRules } from "../src/scan/secret/ruleLoader";

test("loadSecretRules parses Semgrep-style YAML rules", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-rules-"));
  const rulesDir = path.join(workspace, "rules");
  fs.mkdirSync(rulesDir);
  const ruleFile = path.join(rulesDir, "custom.yml");
  fs.writeFileSync(
    ruleFile,
    `rules:
  - id: custom-secret
    message: Custom secret detected
    severity: high
    metadata:
      confidence: high
      remediation: Rotate the credential
    pattern-either:
      - pattern-regex: "\\\\bzz_[A-Za-z0-9]{10}\\\\b"
      - pattern: "BEGIN CUSTOM SECRET"
`,
    "utf8"
  );

  const rules = await loadSecretRules(workspace, {
    rulePaths: [rulesDir],
    defaultRules: false,
    defaultRulesVersion: null,
    rulesUpdateUrl: null,
    rulesRefresh: false,
    rulesCacheTtlMs: 1000,
    entropyThreshold: 4.2,
    minLength: 12,
    minConfidence: "low"
  });

  assert.equal(rules.length, 1);
  assert.equal(rules[0].id, "custom-secret");
  assert.equal(rules[0].confidence, "high");
  assert.equal(rules[0].patterns.length, 2);

  fs.rmSync(workspace, { recursive: true, force: true });
});
