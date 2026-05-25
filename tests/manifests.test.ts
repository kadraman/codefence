import assert from "node:assert/strict";
import test from "node:test";
import { hasDependencyFileChanges } from "../src/manifests";

test("hasDependencyFileChanges detects dependency manifests", () => {
  assert.equal(hasDependencyFileChanges(["src/index.ts", "package.json"]), true);
  assert.equal(hasDependencyFileChanges(["src/index.ts", "docs/readme.md"]), false);
});
