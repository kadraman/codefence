import assert from "node:assert/strict";
import test from "node:test";
import { hasDependencyFileChanges } from "../src/manifests";

test("hasDependencyFileChanges detects dependency manifests", () => {
  assert.equal(hasDependencyFileChanges(["src/index.ts", "package.json"]), true);
  assert.equal(hasDependencyFileChanges(["src/index.ts", "Pipfile.lock"]), true);
  assert.equal(hasDependencyFileChanges(["src/index.ts", "poetry.lock"]), true);
  assert.equal(hasDependencyFileChanges(["src/index.ts", "uv.lock"]), true);
  assert.equal(hasDependencyFileChanges(["src/index.ts", "pyproject.toml"]), true);
  assert.equal(hasDependencyFileChanges(["src/app.ts", "src/demo.sln"]), true);
  assert.equal(hasDependencyFileChanges(["src/app.ts", "projects/sample.csproj"]), true);
  assert.equal(hasDependencyFileChanges(["src/index.ts", "docs/readme.md"]), false);
});
