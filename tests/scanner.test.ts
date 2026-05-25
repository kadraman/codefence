import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { isIgnoredScanPath, scanFile } from "../src/scanner";

test("isIgnoredScanPath skips examples fixture trees", () => {
  const cwd = process.cwd();
  assert.ok(isIgnoredScanPath("examples/java/foo.java", cwd));
  assert.equal(isIgnoredScanPath("src/app.ts", cwd), false);
});

test("scanFile finds hardcoded secret and eval", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-"));
  const file = path.join(tempDir, "bad.ts");
  fs.writeFileSync(
    file,
    `const apiKey = "sk-live-1234567890abcdef";
eval("console.log(1)");
`,
    "utf8"
  );

  const findings = await scanFile(file);
  assert.ok(findings.length >= 2);
  assert.ok(findings.some((finding) => finding.ruleId === "no-hardcoded-secret"));
  assert.ok(findings.some((finding) => finding.ruleId === "no-eval"));

  fs.rmSync(tempDir, { recursive: true, force: true });
});
