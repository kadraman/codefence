import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(__dirname, "..", "..");
const templatesDir = path.join(repoRoot, "templates", "ai");

const LEGACY_PATTERNS = [
  /\bfgr\b/,
  /\.fgr\//,
  /npm run guardrails/,
];

const REQUIRED_PATTERNS = [/codefence scan/, /npm i codefence|`codefence`/];

test("SAST AI templates use codefence local scan only (no external CLI legacy)", () => {
  const files = fs.readdirSync(templatesDir).filter((name) => /\.(md|mdc)$/.test(name));
  assert.ok(files.includes("sast-guardrails.mdc"));
  assert.ok(files.includes("sast-guardrails.fragment.md"));
  assert.ok(files.includes("AGENTS.md"));

  for (const file of files) {
    const content = fs.readFileSync(path.join(templatesDir, file), "utf8");
    for (const pattern of LEGACY_PATTERNS) {
      assert.doesNotMatch(content, pattern, `legacy reference in templates/ai/${file}`);
    }
    for (const pattern of REQUIRED_PATTERNS) {
      assert.match(content, pattern, `expected codefence branding in templates/ai/${file}`);
    }
  }
});

test("sast-guardrails.mdc matches installed Cursor rule template", () => {
  const template = fs.readFileSync(path.join(templatesDir, "sast-guardrails.mdc"), "utf8");
  const installed = fs.readFileSync(
    path.join(repoRoot, ".cursor", "rules", "sast-guardrails.mdc"),
    "utf8"
  );
  assert.equal(template, installed);
});
