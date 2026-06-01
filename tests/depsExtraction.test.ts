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
import { buildDepsSkipMessage } from "../src/scan/deps/extract/manifestSupport";
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

test("extractDependenciesForManifest reads go.mod block require entries", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-gomod-block-"));
  const manifestPath = path.join(tmpDir, "go.mod");
  fs.writeFileSync(
    manifestPath,
    [
      "module example.com/myapp",
      "",
      "go 1.21",
      "",
      "require (",
      "\tgolang.org/x/crypto v0.16.0",
      "\tgithub.com/gin-gonic/gin v1.8.1",
      "\tgithub.com/google/uuid v1.6.0 // indirect",
      ")",
      ""
    ].join("\n"),
    "utf8"
  );

  const result = extractDependenciesForManifestWithDiagnostics(manifestPath);
  assert.deepEqual(
    result.dependencies.map((dep) => `${dep.ecosystem}:${dep.name}@${dep.version}`).sort(),
    [
      "Go:github.com/gin-gonic/gin@1.8.1",
      "Go:github.com/google/uuid@1.6.0",
      "Go:golang.org/x/crypto@0.16.0"
    ]
  );
  assert.equal(result.dependencies.find((dep) => dep.name === "golang.org/x/crypto")?.manifestLine, 6);
  assert.equal(result.warnings.length, 0);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("extractDependenciesForManifest reads go.mod single-line require entries", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-gomod-single-"));
  const manifestPath = path.join(tmpDir, "go.mod");
  fs.writeFileSync(
    manifestPath,
    [
      "module example.com/myapp",
      "",
      "go 1.21",
      "",
      "require golang.org/x/crypto v0.16.0",
      "require github.com/go-jose/go-jose/v3 v3.0.0",
      ""
    ].join("\n"),
    "utf8"
  );

  const result = extractDependenciesForManifestWithDiagnostics(manifestPath);
  assert.deepEqual(
    result.dependencies.map((dep) => `${dep.ecosystem}:${dep.name}@${dep.version}`).sort(),
    [
      "Go:github.com/go-jose/go-jose/v3@3.0.0",
      "Go:golang.org/x/crypto@0.16.0"
    ]
  );
  assert.equal(result.dependencies.find((dep) => dep.name === "golang.org/x/crypto")?.manifestLine, 5);
  assert.equal(result.warnings.length, 0);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("extractDependenciesForManifest skips pseudo-versions in go.mod", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-gomod-pseudo-"));
  const manifestPath = path.join(tmpDir, "go.mod");
  fs.writeFileSync(
    manifestPath,
    [
      "module example.com/myapp",
      "",
      "go 1.21",
      "",
      "require (",
      "\tgolang.org/x/crypto v0.16.0",
      "\tgithub.com/some/dev-dep v0.0.0-20231113122135-a4f7c8f4c9d3",
      ")",
      ""
    ].join("\n"),
    "utf8"
  );

  const result = extractDependenciesForManifestWithDiagnostics(manifestPath);
  assert.deepEqual(
    result.dependencies.map((dep) => `${dep.ecosystem}:${dep.name}@${dep.version}`),
    ["Go:golang.org/x/crypto@0.16.0"]
  );
  assert.equal(result.warnings.length, 0);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("extractDependenciesForManifest returns empty result for malformed go.mod", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-gomod-malformed-"));
  const manifestPath = path.join(tmpDir, "go.mod");
  fs.writeFileSync(manifestPath, "not a valid go.mod\n!!!###", "utf8");

  const result = extractDependenciesForManifestWithDiagnostics(manifestPath);
  assert.deepEqual(result.dependencies, []);
  assert.equal(result.warnings.length, 0);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("extractDependenciesForManifest deduplicates go.mod entries", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-gomod-dedup-"));
  const manifestPath = path.join(tmpDir, "go.mod");
  fs.writeFileSync(
    manifestPath,
    [
      "module example.com/myapp",
      "",
      "go 1.21",
      "",
      "require (",
      "\tgolang.org/x/crypto v0.16.0",
      "\tgolang.org/x/crypto v0.16.0",
      ")",
      ""
    ].join("\n"),
    "utf8"
  );

  const result = extractDependenciesForManifestWithDiagnostics(manifestPath);
  assert.equal(result.dependencies.length, 1);
  assert.equal(result.dependencies[0]?.name, "golang.org/x/crypto");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("extractDependenciesForManifest reads Gemfile exact version pins", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-gemfile-"));
  const manifestPath = path.join(tmpDir, "Gemfile");
  fs.writeFileSync(
    manifestPath,
    [
      "source 'https://rubygems.org'",
      "",
      "gem 'rails', '7.0.4.2'",
      'gem "nokogiri", "~> 1.15"',
      "gem 'rake', '13.0.6'",
      ""
    ].join("\n"),
    "utf8"
  );

  const result = extractDependenciesForManifestWithDiagnostics(manifestPath);
  assert.deepEqual(
    result.dependencies.map((dep) => `${dep.ecosystem}:${dep.name}@${dep.version}`).sort(),
    ["RubyGems:rails@7.0.4.2", "RubyGems:rake@13.0.6"]
  );
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0]?.code, "deps.non-exact-spec");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("extractDependenciesForManifest reads Gemfile.lock resolved versions", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-gemfile-lock-"));
  const manifestPath = path.join(tmpDir, "Gemfile.lock");
  fs.writeFileSync(
    manifestPath,
    [
      "GEM",
      "  remote: https://rubygems.org/",
      "  specs:",
      "    rake (13.0.6)",
      "    rails (7.0.4.2)",
      "      actionpack (= 7.0.4.2)",
      "      rack (~> 2.0, >= 2.0.9)",
      "",
      "PLATFORMS",
      "  ruby",
      ""
    ].join("\n"),
    "utf8"
  );

  const result = extractDependenciesForManifestWithDiagnostics(manifestPath);
  assert.deepEqual(
    result.dependencies.map((dep) => `${dep.ecosystem}:${dep.name}@${dep.version}`).sort(),
    ["RubyGems:actionpack@7.0.4.2", "RubyGems:rails@7.0.4.2", "RubyGems:rake@13.0.6"]
  );
  assert.equal(result.warnings.length, 0);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("extractDependenciesForManifest reads composer.json exact require versions", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-composer-"));
  const manifestPath = path.join(tmpDir, "composer.json");
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        require: {
          php: ">=8.1",
          "monolog/monolog": "2.9.1",
          "symfony/http-foundation": "^6.0"
        },
        "require-dev": {
          phpunit: "9.6.0"
        }
      },
      null,
      2
    ),
    "utf8"
  );

  const result = extractDependenciesForManifestWithDiagnostics(manifestPath);
  assert.deepEqual(
    result.dependencies.map((dep) => `${dep.ecosystem}:${dep.name}@${dep.version}`).sort(),
    ["Packagist:monolog/monolog@2.9.1", "Packagist:phpunit@9.6.0"]
  );
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0]?.code, "deps.non-exact-spec");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("collectDependencies prefers Gemfile.lock over ranged Gemfile entries", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-gemfile-lock-precedence-"));
  fs.writeFileSync(
    path.join(tmpDir, "Gemfile"),
    ["source 'https://rubygems.org'", "", "gem 'rails', '~> 7.0'", "gem 'rake', '13.0.6'", ""].join("\n"),
    "utf8"
  );
  fs.writeFileSync(
    path.join(tmpDir, "Gemfile.lock"),
    ["GEM", "  specs:", "    rake (13.0.6)", "    rails (7.0.4.2)", ""].join("\n"),
    "utf8"
  );

  const result = collectDependencies(makeContext(tmpDir), ["Gemfile", "Gemfile.lock"]);
  assert.deepEqual(
    result.dependencies.map((dep) => `${dep.name}@${dep.version}`).sort(),
    ["rails@7.0.4.2", "rake@13.0.6"]
  );
  assert.ok(result.dependencies.every((dep) => dep.manifestPath === path.join(tmpDir, "Gemfile.lock")));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("collectDependencies warns when Gemfile.lock exists on disk but is not in scan scope", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-gemfile-lock-scope-"));
  fs.writeFileSync(
    path.join(tmpDir, "Gemfile"),
    ["gem 'rails', '~> 7.0'", ""].join("\n"),
    "utf8"
  );
  fs.writeFileSync(path.join(tmpDir, "Gemfile.lock"), ["GEM", "  specs:", "    rails (7.0.4.2)", ""].join("\n"), "utf8");

  const result = collectDependencies(makeContext(tmpDir), ["Gemfile"]);
  assert.equal(result.dependencies.length, 0);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0]?.code, "deps.lockfile-not-in-scope");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("buildDepsSkipMessage names manifests without extractors", () => {
  assert.equal(
    buildDepsSkipMessage(["pom.xml"]),
    "No dependency extractor for: pom.xml. See docs/dependency-support.md."
  );
  assert.equal(
    buildDepsSkipMessage(["Gemfile", "pom.xml"]),
    "No exact-version dependencies extracted from changed manifests. No extractor yet for: pom.xml."
  );
  assert.equal(buildDepsSkipMessage(["Gemfile"]), "No exact-version dependencies extracted from changed manifests.");
  assert.equal(
    buildDepsSkipMessage(["src/App.csproj"]),
    "No exact-version dependencies extracted from changed manifests."
  );
});

test("extractDependenciesForManifest reads csproj PackageReference inline versions", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-csproj-inline-"));
  const manifestPath = path.join(tmpDir, "App.csproj");
  fs.writeFileSync(
    manifestPath,
    [
      '<Project Sdk="Microsoft.NET.Sdk">',
      "  <ItemGroup>",
      '    <PackageReference Include="Newtonsoft.Json" Version="12.0.3" />',
      '    <PackageReference Version="6.0.0" Include="System.Text.Json" />',
      "  </ItemGroup>",
      "</Project>",
      ""
    ].join("\n"),
    "utf8"
  );

  const result = extractDependenciesForManifestWithDiagnostics(manifestPath);
  assert.deepEqual(
    result.dependencies.map((dep) => `${dep.ecosystem}:${dep.name}@${dep.version}`).sort(),
    ["NuGet:Newtonsoft.Json@12.0.3", "NuGet:System.Text.Json@6.0.0"]
  );
  assert.ok(result.dependencies.every((dep) => dep.manifestLine > 0));
  assert.equal(result.warnings.length, 0);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("extractDependenciesForManifest reads csproj PackageReference child Version elements", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-csproj-child-"));
  const manifestPath = path.join(tmpDir, "App.csproj");
  fs.writeFileSync(
    manifestPath,
    [
      "<Project>",
      "  <ItemGroup>",
      '    <PackageReference Include="Microsoft.Extensions.Caching.Memory">',
      "      <Version>6.0.0</Version>",
      "    </PackageReference>",
      "  </ItemGroup>",
      "</Project>",
      ""
    ].join("\n"),
    "utf8"
  );

  const result = extractDependenciesForManifestWithDiagnostics(manifestPath);
  assert.deepEqual(result.dependencies.map((dep) => `${dep.name}@${dep.version}`), [
    "Microsoft.Extensions.Caching.Memory@6.0.0"
  ]);
  assert.equal(result.dependencies[0]?.manifestLine, 3);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("extractDependenciesForManifest skips ranged csproj PackageReference versions", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-csproj-range-"));
  const manifestPath = path.join(tmpDir, "App.csproj");
  fs.writeFileSync(
    manifestPath,
    [
      "<Project>",
      "  <ItemGroup>",
      '    <PackageReference Include="Serilog" Version="2.*" />',
      '    <PackageReference Include="Newtonsoft.Json" Version="12.0.3" />',
      "  </ItemGroup>",
      "</Project>",
      ""
    ].join("\n"),
    "utf8"
  );

  const result = extractDependenciesForManifestWithDiagnostics(manifestPath);
  assert.deepEqual(result.dependencies.map((dep) => `${dep.name}@${dep.version}`), ["Newtonsoft.Json@12.0.3"]);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0]?.code, "deps.non-exact-spec");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
