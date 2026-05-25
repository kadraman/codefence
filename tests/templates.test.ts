import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(__dirname, "..", "..");
const templatesDir = path.join(repoRoot, "templates", "ai");

const LEGACY_PATTERNS = [
  /\bfgr\b/,
  /\.fgr\//,
  /npm run codefence/,
];

const REQUIRED_PATTERNS = [/codefence scan/, /npm i codefence|`codefence`/];

test("codefence-guardrails.mdc matches installed Cursor rule template", () => {
  const template = fs.readFileSync(path.join(templatesDir, "codefence-guardrails.mdc"), "utf8");
  const installed = fs.readFileSync(
    path.join(repoRoot, ".cursor", "rules", "codefence-guardrails.mdc"),
    "utf8"
  );
  assert.equal(template, installed);
});
