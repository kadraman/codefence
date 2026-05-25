import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { scanSecretFindings } from "../src/scan/secret/engine";
import { defaultSecretScanOptions } from "../src/scan/secret/config";

function writeCaseRule(workspace: string, yaml: string): string {
  const rulesDir = path.join(workspace, "rules");
  fs.mkdirSync(rulesDir, { recursive: true });
  const ruleFile = path.join(rulesDir, "case.yml");
  fs.writeFileSync(ruleFile, yaml, "utf8");
  return rulesDir;
}

test("pattern-regex is case-sensitive by default", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-regex-case-"));
  const rulesDir = writeCaseRule(
    workspace,
    `rules:
  - id: bearer-sensitive
    message: Bearer token
    severity: high
    pattern-regex: "\\\\bBearer\\\\s+[A-Za-z0-9]{8,}"
`
  );

  const options = {
    ...defaultSecretScanOptions(),
    rulePaths: [rulesDir],
    defaultRules: false
  };

  const upper = await scanSecretFindings({
    filePath: "sample.ts",
    content: 'const x = "Bearer abcdefgh";\n',
    workspace,
    options
  });
  const lower = await scanSecretFindings({
    filePath: "sample.ts",
    content: 'const x = "bearer abcdefgh";\n',
    workspace,
    options
  });

  assert.equal(upper.some((f) => f.ruleId === "bearer-sensitive"), true);
  assert.equal(lower.some((f) => f.ruleId === "bearer-sensitive"), false);

  fs.rmSync(workspace, { recursive: true, force: true });
});

test("pattern-regex honors metadata case-insensitive opt-in", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-regex-caseless-"));
  const rulesDir = writeCaseRule(
    workspace,
    `rules:
  - id: bearer-insensitive
    message: Bearer token
    severity: high
    metadata:
      case-insensitive: true
    pattern-regex: "\\\\bBearer\\\\s+[A-Za-z0-9]{8,}"
`
  );

  const options = {
    ...defaultSecretScanOptions(),
    rulePaths: [rulesDir],
    defaultRules: false
  };

  const lower = await scanSecretFindings({
    filePath: "sample.ts",
    content: 'const x = "bearer abcdefgh";\n',
    workspace,
    options
  });

  assert.equal(lower.some((f) => f.ruleId === "bearer-insensitive"), true);

  fs.rmSync(workspace, { recursive: true, force: true });
});
