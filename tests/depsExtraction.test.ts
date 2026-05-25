import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { extractPackageJsonDependencies } from "../src/scan/deps/extract";

test("extractPackageJsonDependencies returns exact npm versions only", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-deps-"));
  const packageJsonPath = path.join(tmpDir, "package.json");
  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify(
      {
        dependencies: {
          lodash: "4.17.21",
          react: "^19.0.0"
        },
        devDependencies: {
          typescript: "=5.9.0"
        },
        optionalDependencies: {
          yaml: "v2.9.0"
        }
      },
      null,
      2
    ),
    "utf8"
  );

  const deps = extractPackageJsonDependencies(packageJsonPath);
  assert.deepEqual(
    deps.map((dep) => `${dep.name}@${dep.version}`).sort(),
    ["lodash@4.17.21", "typescript@5.9.0", "yaml@2.9.0"]
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

