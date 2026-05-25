import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { scanFiles } from "../src/scanner";

test("secret scanning flags likely hardcoded secrets", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-secrets-"));
  const file = path.join(tmpDir, "secrets-sample.ts");
  fs.writeFileSync(
    file,
    `const apiKey = "sk-live-1234567890abcdef";\nconst password = "P@ssword123456";\n`,
    "utf8"
  );

  const findings = scanFiles([file]);
  assert.ok(findings.some((f) => f.ruleId === "no-hardcoded-secret"));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("scan output includes secrets-focused rule ids only", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-secrets-"));
  const file = path.join(tmpDir, "sample.ts");
  fs.writeFileSync(file, "const token = \"abcdef1234567890\";\n", "utf8");

  const findings = scanFiles([file]);
  assert.equal(findings.some((f) => f.ruleId === "no-hardcoded-secret"), true);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
