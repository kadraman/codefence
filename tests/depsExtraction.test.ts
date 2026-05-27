import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { collectDependencies } from "../src/scan/aspects/deps";
import { defaultDepsScanOptions } from "../src/scan/deps/config";
import {
  extractDependenciesForManifest,
  extractDependenciesForManifestWithDiagnostics,
  extractPackageJsonDependencies
} from "../src/scan/deps/extract";
import { defaultSecretScanOptions } from "../src/scan/secret/config";
import { ScanContext } from "../src/scan/types";

const LOCK_FIXTURE_ROOT = path.join(process.cwd(), "tests", "fixtures", "locks");

function makeContext(cwd: string): ScanContext {
  return {
    cwd,
    files: [],
    staged: false,
    explicitPaths: true,
    depsManifestPaths: null,
    options: {
      staged: false,
      paths: [],
      only: ["deps"],
      skip: [],
      secret: defaultSecretScanOptions(),
      deps: defaultDepsScanOptions(),
      outputFormat: "json",
      quiet: true,
      verbose: false
    }
  };
}

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
  assert.equal(deps.find((dep) => dep.name === "lodash")?.manifestLine, 3);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("extractDependenciesForManifest reads package-lock.json v2 and v3 entries", () => {
  const v3Path = path.join(LOCK_FIXTURE_ROOT, "package-lock-v3-minimal.json");
  const v3Deps = extractDependenciesForManifest(v3Path);
  assert.deepEqual(
    v3Deps.map((dep) => `${dep.name}@${dep.version}`).sort(),
    ["@types/node@25.9.1", "lodash@4.17.20"]
  );
  assert.ok(v3Deps.every((dep) => dep.manifestPath === v3Path));
  assert.ok(v3Deps.every((dep) => dep.manifestLine > 0));

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-package-lock-v2-"));
  const v2Path = path.join(tmpDir, "package-lock.json");
  fs.writeFileSync(
    v2Path,
    JSON.stringify(
      {
        name: "legacy-example",
        lockfileVersion: 2,
        dependencies: {
          minimist: {
            version: "1.2.5"
          },
          ws: {
            version: "7.3.0"
          }
        }
      },
      null,
      2
    ),
    "utf8"
  );

  const v2Deps = extractDependenciesForManifest(v2Path);
  assert.deepEqual(
    v2Deps.map((dep) => `${dep.name}@${dep.version}`).sort(),
    ["minimist@1.2.5", "ws@7.3.0"]
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("extractDependenciesForManifest reads Yarn Classic lockfiles", () => {
  const manifestPath = path.join(LOCK_FIXTURE_ROOT, "yarn-classic-minimal.lock");
  const deps = extractDependenciesForManifest(manifestPath);

  assert.deepEqual(
    deps.map((dep) => `${dep.name}@${dep.version}`).sort(),
    ["@types/node@25.9.1", "lodash@4.17.20"]
  );
  assert.ok(deps.every((dep) => dep.manifestLine > 0));
});

test("extractDependenciesForManifest reads pnpm lockfiles", () => {
  const manifestPath = path.join(LOCK_FIXTURE_ROOT, "pnpm-minimal.yaml");
  const deps = extractDependenciesForManifest(manifestPath);

  assert.deepEqual(
    deps.map((dep) => `${dep.name}@${dep.version}`).sort(),
    ["@types/node@25.9.1", "lodash@4.17.20"]
  );
  assert.ok(deps.every((dep) => dep.manifestLine > 0));
});

test("extractDependenciesForManifestWithDiagnostics warns for unsupported lockfiles", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-yarn-berry-"));
  const yarnLockPath = path.join(tmpDir, "yarn.lock");
  fs.writeFileSync(
    yarnLockPath,
    `__metadata:\n  version: 6\n\nlodash@npm:^4.17.0:\n  version: 4.17.20\n`,
    "utf8"
  );

  const result = extractDependenciesForManifestWithDiagnostics(yarnLockPath);
  assert.deepEqual(result.dependencies, []);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0] ?? "", /Yarn Berry/);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("collectDependencies prefers sibling lockfiles over ranged package.json manifests", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-lockfile-precedence-"));
  fs.writeFileSync(
    path.join(tmpDir, "package.json"),
    JSON.stringify(
      {
        dependencies: {
          lodash: "^4.17.0"
        }
      },
      null,
      2
    ),
    "utf8"
  );
  fs.writeFileSync(
    path.join(tmpDir, "package-lock.json"),
    JSON.stringify(
      {
        name: "app",
        lockfileVersion: 3,
        packages: {
          "": {
            name: "app",
            dependencies: {
              lodash: "^4.17.0"
            }
          },
          "node_modules/lodash": {
            version: "4.17.20"
          }
        }
      },
      null,
      2
    ),
    "utf8"
  );

  const deps = collectDependencies(makeContext(tmpDir), ["package.json", "package-lock.json"]);
  assert.deepEqual(deps.map((dep) => `${dep.name}@${dep.version}`), ["lodash@4.17.20"]);
  assert.equal(deps[0]?.manifestPath, path.join(tmpDir, "package-lock.json"));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("collectDependencies prefers pnpm-lock.yaml when multiple lockfiles are present", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-lockfile-priority-"));
  fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ dependencies: { lodash: "^4.17.0" } }, null, 2));
  fs.writeFileSync(path.join(tmpDir, "package-lock.json"), fs.readFileSync(path.join(LOCK_FIXTURE_ROOT, "package-lock-v3-minimal.json"), "utf8"));
  fs.writeFileSync(path.join(tmpDir, "yarn.lock"), fs.readFileSync(path.join(LOCK_FIXTURE_ROOT, "yarn-classic-minimal.lock"), "utf8"));
  fs.writeFileSync(path.join(tmpDir, "pnpm-lock.yaml"), fs.readFileSync(path.join(LOCK_FIXTURE_ROOT, "pnpm-minimal.yaml"), "utf8"));

  const deps = collectDependencies(makeContext(tmpDir), [
    "package.json",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml"
  ]);

  assert.equal(deps.length, 2);
  assert.ok(deps.every((dep) => dep.manifestPath === path.join(tmpDir, "pnpm-lock.yaml")));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
