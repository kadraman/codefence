import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "..", "..", "package.json"), "utf8")
) as {
  name: string;
  bin?: Record<string, string>;
  scripts?: Record<string, string>;
};

test("package.json publishes codefence with codefence binary", () => {
  assert.equal(packageJson.name, "codefence");
  assert.deepEqual(packageJson.bin, { codefence: "dist/src/cli.js" });
  assert.match(packageJson.scripts?.codefence ?? "", /scan --staged/);
  assert.equal(packageJson.scripts?.guardrails, undefined);
});
