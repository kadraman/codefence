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
import { normalizeInstalledVersion } from "../src/scan/deps/extract/shared";
import { defaultSecretScanOptions } from "../src/scan/secret/config";
import { ScanContext } from "../src/scan/types";

const LOCK_FIXTURE_ROOT = path.join(process.cwd(), "tests", "fixtures", "locks");

function writeNamedFixture(tmpDir: string, fileName: string, fixtureName: string): string {
  const targetPath = path.join(tmpDir, fileName);
  fs.copyFileSync(path.join(LOCK_FIXTURE_ROOT, fixtureName), targetPath);
  return targetPath;
}

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
      gitIgnoredPrefixes: ["examples/"],
      defaultAspects: ["code"],
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

test("normalizeInstalledVersion rejects non-semver installed values", () => {
  assert.equal(normalizeInstalledVersion("git+https://github.com/user/repo.git"), null);
  assert.equal(normalizeInstalledVersion("https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz"), null);
  assert.equal(normalizeInstalledVersion("abcdef1234567890"), null);
  assert.equal(normalizeInstalledVersion("npm:lodash@4.17.21"), "4.17.21");
  assert.equal(normalizeInstalledVersion("v1.2.3"), "1.2.3");
});

test("extractDependenciesForManifest reads package-lock.json v2 and v3 entries", () => {
  const v3Dir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-package-lock-v3-"));
  const v3Path = writeNamedFixture(v3Dir, "package-lock.json", "package-lock-v3-minimal.json");
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

  fs.rmSync(v3Dir, { recursive: true, force: true });
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("extractDependenciesForManifest reads Yarn Classic lockfiles", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-yarn-classic-"));
  const manifestPath = writeNamedFixture(tmpDir, "yarn.lock", "yarn-classic-minimal.lock");
  const deps = extractDependenciesForManifest(manifestPath);

  assert.deepEqual(
    deps.map((dep) => `${dep.name}@${dep.version}`).sort(),
    ["@types/node@25.9.1", "lodash@4.17.20"]
  );
  assert.ok(deps.every((dep) => dep.manifestLine > 0));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("extractDependenciesForManifest reads pnpm lockfiles", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-pnpm-lock-"));
  const manifestPath = writeNamedFixture(tmpDir, "pnpm-lock.yaml", "pnpm-minimal.yaml");
  const deps = extractDependenciesForManifest(manifestPath);

  assert.deepEqual(
    deps.map((dep) => `${dep.name}@${dep.version}`).sort(),
    ["@types/node@25.9.1", "lodash@4.17.20"]
  );
  assert.ok(deps.every((dep) => dep.manifestLine > 0));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("extractDependenciesForManifest reads pinned requirements.txt entries", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-requirements-"));
  const manifestPath = path.join(tmpDir, "requirements.txt");
  fs.writeFileSync(
    manifestPath,
    [
      "django==2.2.24",
      "requests>=2.31.0",
      "uvicorn[standard]==0.30.0 ; python_version >= '3.9'",
      "--extra-index-url https://example.com/simple",
      ""
    ].join("\n"),
    "utf8"
  );

  const result = extractDependenciesForManifestWithDiagnostics(manifestPath);
  assert.deepEqual(
    result.dependencies.map((dep) => `${dep.ecosystem}:${dep.name}@${dep.version}`).sort(),
    ["PyPI:django@2.2.24", "PyPI:uvicorn@0.30.0"]
  );
  assert.equal(result.dependencies.find((dep) => dep.name === "django")?.manifestLine, 1);
  assert.equal(result.dependencies.find((dep) => dep.name === "uvicorn")?.manifestLine, 3);
  assert.equal(result.warnings.length, 1);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("extractDependenciesForManifest reads pinned Pipfile entries", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-pipfile-"));
  const manifestPath = path.join(tmpDir, "Pipfile");
  fs.writeFileSync(
    manifestPath,
    [
      "[packages]",
      'django = "==2.2.24"',
      'requests = ">=2.31.0"',
      'flask = {version = "==2.2.5", extras = ["async"]}',
      "",
      "[dev-packages]",
      'pytest = "==7.4.0"',
      ""
    ].join("\n"),
    "utf8"
  );

  const result = extractDependenciesForManifestWithDiagnostics(manifestPath);
  assert.deepEqual(
    result.dependencies.map((dep) => `${dep.ecosystem}:${dep.name}@${dep.version}`).sort(),
    ["PyPI:django@2.2.24", "PyPI:flask@2.2.5", "PyPI:pytest@7.4.0"]
  );
  assert.equal(result.warnings.length, 1);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("extractDependenciesForManifest reads pinned pyproject.toml dependencies", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-pyproject-"));
  const manifestPath = path.join(tmpDir, "pyproject.toml");
  fs.writeFileSync(
    manifestPath,
    [
      "[project]",
      "dependencies = [",
      '  "urllib3==1.26.4",',
      '  "requests>=2.31.0",',
      '  "idna==3.7; python_version >= \'3.9\'"',
      "]",
      "",
      "[project.optional-dependencies]",
      'dev = ["pytest==7.4.0", "mypy>=1.0"]',
      ""
    ].join("\n"),
    "utf8"
  );

  const result = extractDependenciesForManifestWithDiagnostics(manifestPath);
  assert.deepEqual(
    result.dependencies.map((dep) => `${dep.ecosystem}:${dep.name}@${dep.version}`).sort(),
    ["PyPI:idna@3.7", "PyPI:pytest@7.4.0", "PyPI:urllib3@1.26.4"]
  );
  assert.equal(result.dependencies.find((dep) => dep.name === "urllib3")?.manifestLine, 3);
  assert.equal(result.warnings.length, 1);

  fs.rmSync(tmpDir, { recursive: true, force: true });
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
  fs.writeFileSync(
    path.join(tmpDir, "package.json"),
    JSON.stringify({ dependencies: { lodash: "^4.17.0" } }, null, 2)
  );
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

test("collectDependencies returns no deps for ranged package.json without lockfile", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-ranged-only-"));
  fs.writeFileSync(
    path.join(tmpDir, "package.json"),
    JSON.stringify(
      {
        dependencies: {
          lodash: "^4.17.0",
          react: "~19.0.0"
        }
      },
      null,
      2
    ),
    "utf8"
  );

  const deps = collectDependencies(makeContext(tmpDir), ["package.json"]);
  assert.deepEqual(deps, []);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
