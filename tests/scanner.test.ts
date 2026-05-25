import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { isIgnoredScanPath, scanFile } from "../src/scanner";

test("isIgnoredScanPath skips examples and sast fixture trees", () => {
  const cwd = process.cwd();
  assert.ok(isIgnoredScanPath("examples/java/foo.java", cwd));
  assert.ok(isIgnoredScanPath("tests/sast/foo.spec.ts", cwd));
  assert.ok(isIgnoredScanPath("src/rules/sast/rule.ts", cwd));
  assert.equal(isIgnoredScanPath("src/app.ts", cwd), false);
});

test("scanFile finds hardcoded secret and eval", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-"));
  const file = path.join(tempDir, "bad.ts");
  fs.writeFileSync(
    file,
    `const apiKey = "sk-live-1234567890abcdef";
eval("console.log(1)");
`,
    "utf8"
  );

  const findings = scanFile(file);
  assert.ok(findings.length >= 2);

  fs.rmSync(tempDir, { recursive: true, force: true });
});
