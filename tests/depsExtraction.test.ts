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
  assert.equal(result.warnings[0]?.code, "deps.unsupported-lockfile");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("extractDependenciesForManifest reads Pipfile.lock resolved versions", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-pipfile-lock-"));
  const manifestPath = writeNamedFixture(tmpDir, "Pipfile.lock", "pipfile-lock-minimal.json");
  const result = extractDependenciesForManifestWithDiagnostics(manifestPath);

  assert.deepEqual(
    result.dependencies.map((dep) => `${dep.ecosystem}:${dep.name}@${dep.version}`).sort(),
    [
      "PyPI:click@8.1.7",
      "PyPI:pytest@7.4.0",
      "PyPI:requests@2.31.0"
    ]
  );
  assert.ok(result.dependencies.every((dep) => dep.manifestLine > 0));
  assert.equal(result.warnings.length, 0);
  assert.ok(!result.dependencies.some((dep) => dep.name === "git-only"));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("extractDependenciesForManifest reads poetry.lock resolved versions", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-poetry-lock-"));
  const manifestPath = writeNamedFixture(tmpDir, "poetry.lock", "poetry-lock-minimal.lock");
  const result = extractDependenciesForManifestWithDiagnostics(manifestPath);

  assert.deepEqual(
    result.dependencies.map((dep) => `${dep.ecosystem}:${dep.name}@${dep.version}`).sort(),
    ["PyPI:pytest@7.4.0", "PyPI:requests@2.31.0", "PyPI:urllib3@1.26.4"]
  );
  assert.ok(result.dependencies.every((dep) => dep.manifestLine > 0));
  assert.equal(result.warnings.length, 0);
  assert.ok(!result.dependencies.some((dep) => dep.name === "private-git-lib"));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("extractDependenciesForManifest warns for malformed Pipfile.lock", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-pipfile-lock-bad-"));
  const manifestPath = path.join(tmpDir, "Pipfile.lock");
  fs.writeFileSync(manifestPath, "{not-json", "utf8");

  const result = extractDependenciesForManifestWithDiagnostics(manifestPath);
  assert.deepEqual(result.dependencies, []);
  assert.equal(result.warnings[0]?.code, "deps.malformed-lockfile");

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

  const deps = collectDependencies(makeContext(tmpDir), ["package.json", "package-lock.json"]).dependencies;
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
  ]).dependencies;

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

  const deps = collectDependencies(makeContext(tmpDir), ["package.json"]).dependencies;
  assert.deepEqual(deps, []);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("collectDependencies prefers Pipfile.lock over ranged Pipfile entries", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-pipfile-lock-precedence-"));
  fs.writeFileSync(
    path.join(tmpDir, "Pipfile"),
    ['[packages]', 'click = ">=8.1.0"', 'requests = "==2.31.0"', ""].join("\n"),
    "utf8"
  );
  writeNamedFixture(tmpDir, "Pipfile.lock", "pipfile-lock-minimal.json");

  const deps = collectDependencies(makeContext(tmpDir), ["Pipfile", "Pipfile.lock"]).dependencies;
  assert.deepEqual(
    deps.map((dep) => `${dep.name}@${dep.version}`).sort(),
    ["click@8.1.7", "pytest@7.4.0", "requests@2.31.0"]
  );
  assert.ok(deps.every((dep) => dep.manifestPath === path.join(tmpDir, "Pipfile.lock")));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("collectDependencies prefers poetry.lock over ranged pyproject.toml entries", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-poetry-lock-precedence-"));
  fs.writeFileSync(
    path.join(tmpDir, "pyproject.toml"),
    [
      "[project]",
      "dependencies = [",
      '  "urllib3==1.26.4",',
      '  "requests>=2.31.0",',
      "]",
      ""
    ].join("\n"),
    "utf8"
  );
  writeNamedFixture(tmpDir, "poetry.lock", "poetry-lock-minimal.lock");

  const deps = collectDependencies(makeContext(tmpDir), ["pyproject.toml", "poetry.lock"]).dependencies;
  assert.deepEqual(
    deps.map((dep) => `${dep.name}@${dep.version}`).sort(),
    ["pytest@7.4.0", "requests@2.31.0", "urllib3@1.26.4"]
  );
  assert.ok(deps.every((dep) => dep.manifestPath === path.join(tmpDir, "poetry.lock")));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("extractDependenciesForManifest reads uv.lock resolved versions", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-uv-lock-"));
  const manifestPath = writeNamedFixture(tmpDir, "uv.lock", "uv-lock-minimal.lock");
  const result = extractDependenciesForManifestWithDiagnostics(manifestPath);

  assert.deepEqual(
    result.dependencies.map((dep) => `${dep.ecosystem}:${dep.name}@${dep.version}`).sort(),
    ["PyPI:certifi@2024.7.4", "PyPI:requests@2.31.0", "PyPI:urllib3@1.26.4"]
  );
  assert.ok(result.dependencies.every((dep) => dep.manifestLine > 0));
  assert.equal(result.warnings.length, 0);
  assert.ok(!result.dependencies.some((dep) => dep.name === "private-git-lib"));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("collectDependencies prefers uv.lock over ranged pyproject.toml entries", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-uv-lock-precedence-"));
  fs.writeFileSync(
    path.join(tmpDir, "pyproject.toml"),
    [
      "[project]",
      "dependencies = [",
      '  "urllib3==1.26.4",',
      '  "requests>=2.31.0",',
      "]",
      ""
    ].join("\n"),
    "utf8"
  );
  writeNamedFixture(tmpDir, "uv.lock", "uv-lock-minimal.lock");

  const result = collectDependencies(makeContext(tmpDir), ["pyproject.toml", "uv.lock"]);
  assert.deepEqual(
    result.dependencies.map((dep) => `${dep.name}@${dep.version}`).sort(),
    ["certifi@2024.7.4", "requests@2.31.0", "urllib3@1.26.4"]
  );
  assert.ok(result.dependencies.every((dep) => dep.manifestPath === path.join(tmpDir, "uv.lock")));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("collectDependencies prefers uv.lock over poetry.lock when both are present", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-uv-poetry-lock-precedence-"));
  fs.writeFileSync(
    path.join(tmpDir, "pyproject.toml"),
    ['[project]', 'dependencies = ["requests>=2.31.0"]', ""].join("\n"),
    "utf8"
  );
  writeNamedFixture(tmpDir, "uv.lock", "uv-lock-minimal.lock");
  writeNamedFixture(tmpDir, "poetry.lock", "poetry-lock-minimal.lock");

  const result = collectDependencies(makeContext(tmpDir), ["pyproject.toml", "uv.lock", "poetry.lock"]);
  assert.deepEqual(
    result.dependencies.map((dep) => `${dep.name}@${dep.version}`).sort(),
    ["certifi@2024.7.4", "requests@2.31.0", "urllib3@1.26.4"]
  );
  assert.ok(result.dependencies.every((dep) => dep.manifestPath === path.join(tmpDir, "uv.lock")));
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0]?.code, "deps.multiple-lockfiles");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("collectDependencies keeps requirements.txt when no python lockfile is present", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-requirements-only-"));
  fs.writeFileSync(path.join(tmpDir, "requirements.txt"), "django==2.2.24\nrequests>=2.31.0\n", "utf8");

  const deps = collectDependencies(makeContext(tmpDir), ["requirements.txt"]).dependencies;
  assert.deepEqual(deps.map((dep) => `${dep.name}@${dep.version}`), ["django@2.2.24"]);
  assert.equal(deps[0]?.manifestPath, path.join(tmpDir, "requirements.txt"));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("extractDependenciesForManifest follows -r includes in requirements.txt", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-requirements-includes-"));
  fs.writeFileSync(path.join(tmpDir, "requirements-dev.txt"), "pytest==7.4.0\nrequests>=2.31.0\n", "utf8");
  fs.writeFileSync(
    path.join(tmpDir, "requirements.txt"),
    ["django==2.2.24", "-r requirements-dev.txt", "click==8.1.7", ""].join("\n"),
    "utf8"
  );

  const result = extractDependenciesForManifestWithDiagnostics(path.join(tmpDir, "requirements.txt"));
  assert.deepEqual(
    result.dependencies.map((dep) => `${dep.ecosystem}:${dep.name}@${dep.version}`).sort(),
    ["PyPI:click@8.1.7", "PyPI:django@2.2.24", "PyPI:pytest@7.4.0"]
  );
  assert.equal(result.dependencies.find((dep) => dep.name === "pytest")?.manifestPath, path.join(tmpDir, "requirements-dev.txt"));
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0]?.code, "deps.non-exact-spec");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("extractDependenciesForManifest warns for missing requirements include", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-requirements-missing-include-"));
  fs.writeFileSync(path.join(tmpDir, "requirements.txt"), "django==2.2.24\n-r missing.txt\n", "utf8");

  const result = extractDependenciesForManifestWithDiagnostics(path.join(tmpDir, "requirements.txt"));
  assert.deepEqual(result.dependencies.map((dep) => dep.name), ["django"]);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0]?.code, "deps.requirements-include-missing");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("extractDependenciesForManifest warns for circular requirements includes", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-requirements-cycle-"));
  fs.writeFileSync(path.join(tmpDir, "a.txt"), "-r b.txt\ndjango==2.2.24\n", "utf8");
  fs.writeFileSync(path.join(tmpDir, "b.txt"), "-r a.txt\n", "utf8");
  fs.writeFileSync(path.join(tmpDir, "requirements.txt"), "-r a.txt\n", "utf8");

  const result = extractDependenciesForManifestWithDiagnostics(path.join(tmpDir, "requirements.txt"));
  assert.deepEqual(result.dependencies.map((dep) => dep.name), ["django"]);
  assert.ok(result.warnings.some((warning) => warning.code === "deps.requirements-include-cycle"));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("collectDependencies warns when Pipfile.lock exists on disk but is not in scan scope", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-pipfile-lock-unscoped-"));
  fs.writeFileSync(
    path.join(tmpDir, "Pipfile"),
    ['[packages]', 'click = ">=8.1.0"', 'flask = ">=2.0.0"', ""].join("\n"),
    "utf8"
  );
  writeNamedFixture(tmpDir, "Pipfile.lock", "pipfile-lock-minimal.json");

  const result = collectDependencies(makeContext(tmpDir), ["Pipfile"]);
  assert.deepEqual(result.dependencies, []);
  assert.ok(result.warnings.some((warning) => warning.code === "deps.lockfile-not-in-scope"));
  assert.ok(result.warnings.some((warning) => warning.message.includes("Pipfile.lock")));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("collectDependencies warns when uv.lock exists on disk but is not in scan scope", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-uv-lock-unscoped-"));
  fs.writeFileSync(
    path.join(tmpDir, "pyproject.toml"),
    ['[project]', 'dependencies = ["requests>=2.31.0"]', ""].join("\n"),
    "utf8"
  );
  writeNamedFixture(tmpDir, "uv.lock", "uv-lock-minimal.lock");

  const result = collectDependencies(makeContext(tmpDir), ["pyproject.toml"]);
  assert.deepEqual(result.dependencies, []);
  assert.ok(result.warnings.some((warning) => warning.code === "deps.lockfile-not-in-scope"));
  assert.ok(result.warnings.some((warning) => warning.message.includes("uv.lock")));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("collectDependencies warns when package-lock.json exists on disk but is not in scan scope", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-npm-lock-unscoped-"));
  fs.writeFileSync(
    path.join(tmpDir, "package.json"),
    JSON.stringify({ dependencies: { lodash: "^4.17.0" } }, null, 2),
    "utf8"
  );
  fs.writeFileSync(
    path.join(tmpDir, "package-lock.json"),
    JSON.stringify(
      {
        name: "app",
        lockfileVersion: 3,
        packages: {
          "": { name: "app", dependencies: { lodash: "^4.17.0" } },
          "node_modules/lodash": { version: "4.17.20" }
        }
      },
      null,
      2
    ),
    "utf8"
  );

  const result = collectDependencies(makeContext(tmpDir), ["package.json"]);
  assert.deepEqual(result.dependencies, []);
  assert.ok(result.warnings.some((warning) => warning.code === "deps.lockfile-not-in-scope"));
  assert.ok(result.warnings.some((warning) => warning.message.includes("package-lock.json")));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("collectDependencies does not warn about unscoped lockfiles when lockfile is in scan scope", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-lockfile-scoped-"));
  fs.writeFileSync(
    path.join(tmpDir, "pyproject.toml"),
    ['[project]', 'dependencies = ["requests>=2.31.0"]', ""].join("\n"),
    "utf8"
  );
  writeNamedFixture(tmpDir, "uv.lock", "uv-lock-minimal.lock");

  const result = collectDependencies(makeContext(tmpDir), ["pyproject.toml", "uv.lock"]);
  assert.ok(result.dependencies.length > 0);
  assert.ok(!result.warnings.some((warning) => warning.code === "deps.lockfile-not-in-scope"));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
