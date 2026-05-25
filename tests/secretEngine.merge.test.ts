import assert from "node:assert/strict";
import test from "node:test";
import { scanSecretFindings } from "../src/scan/secret/engine";
import { defaultSecretScanOptions } from "../src/scan/secret/config";

test("merges rule and entropy at the same line with rule+entropy detectionMethod", async () => {
  const content = `const apiKey = "Q4z8vB2nLp9sTw7xYk3mHc6rJd1fabcdefghij";\n`;
  const findings = await scanSecretFindings({
    filePath: "sample.ts",
    content,
    workspace: process.cwd(),
    options: defaultSecretScanOptions()
  });

  const combined = findings.find((f) => f.ruleId === "no-hardcoded-secret");
  assert.ok(combined);
  assert.equal(combined?.detectionMethod, "rule+entropy");
  assert.match(combined?.evidence ?? "", /entropy=/);
  assert.match(combined?.evidence ?? "", /matched secret pattern/);
  assert.equal(findings.some((f) => f.ruleId === "secret-high-entropy"), false);
});

test("keeps standalone entropy findings when no rule matches the line", async () => {
  const content = `const entropyBlob = "Q4z8vB2nLp9sTw7xYk3mHc6rJd1f";\n`;
  const findings = await scanSecretFindings({
    filePath: "sample.ts",
    content,
    workspace: process.cwd(),
    options: defaultSecretScanOptions()
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.ruleId, "secret-high-entropy");
  assert.equal(findings[0]?.detectionMethod, "entropy");
});
