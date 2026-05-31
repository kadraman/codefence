import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import type { Finding } from "../src/types";
import { runScan } from "../src/scan/runner";
import {
  colorSeverity,
  isScanQuiet,
  printScanWarnings,
  printUnifiedFindings,
  writeScanLog,
  writeScanStatus
} from "../src/scan/output";
import { defaultDepsScanOptions } from "../src/scan/deps/config";
import { defaultSecretScanOptions } from "../src/scan/secret/config";

const jsonControl = { outputFormat: "json" as const, quiet: true, verbose: false };
const jsonVerboseControl = { outputFormat: "json" as const, quiet: false, verbose: true };
const tableControl = { outputFormat: "table" as const, quiet: false, verbose: false };

test("colorSeverity uses bright red through amber gradient", () => {
  assert.match(colorSeverity("CRITICAL"), /\u001b\[1m\u001b\[91mCRITICAL/);
  assert.match(colorSeverity("HIGH"), /\u001b\[31mHIGH/);
  assert.match(colorSeverity("MEDIUM"), /\u001b\[38;5;208mMEDIUM/);
  assert.match(colorSeverity("LOW"), /\u001b\[38;5;220mLOW/);
});

test("writeScanStatus colors section titles in table mode", () => {
  const stdout: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    stdout.push(args.map(String).join(" "));
  };

  try {
    writeScanStatus("\n--- Dependency vulnerability checks (deps) ---", tableControl);
    assert.match(stdout[0] ?? "", /\u001b\[93m--- Dependency vulnerability checks \(deps\) ---\u001b\[0m/);
  } finally {
    console.log = originalLog;
  }
});

test("isScanQuiet defaults json output to quiet unless verbose", () => {
  assert.equal(isScanQuiet({ outputFormat: "json", quiet: false, verbose: false }), true);
  assert.equal(isScanQuiet(jsonVerboseControl), false);
  assert.equal(isScanQuiet({ outputFormat: "table", quiet: false, verbose: false }), false);
  assert.equal(isScanQuiet({ outputFormat: "table", quiet: true, verbose: false }), true);
});

test("writeScanStatus keeps stdout clean in default json mode", () => {
  const stderr: string[] = [];
  const stdout: string[] = [];
  const originalError = console.error;
  const originalLog = console.log;
  console.error = (...args: unknown[]) => {
    stderr.push(args.map(String).join(" "));
  };
  console.log = (...args: unknown[]) => {
    stdout.push(args.map(String).join(" "));
  };

  try {
    writeScanStatus("[deps] No vulnerabilities", jsonControl);
    assert.deepEqual(stdout, []);
    assert.deepEqual(stderr, []);

    writeScanStatus("[deps] No vulnerabilities", jsonVerboseControl);
    assert.deepEqual(stdout, []);
    assert.deepEqual(stderr, ["[deps] No vulnerabilities"]);

    stdout.length = 0;
    writeScanStatus("[deps] No vulnerabilities", tableControl);
    assert.match(stdout[0] ?? "", /\u001b\[93m\[deps\] \u001b\[0mNo vulnerabilities/);
  } finally {
    console.error = originalError;
    console.log = originalLog;
  }
});

test("writeScanLog uses stderr and respects quiet json mode", () => {
  const stderr: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    stderr.push(args.map(String).join(" "));
  };

  try {
    writeScanLog("[deps] 2 finding(s):", jsonControl);
    assert.deepEqual(stderr, []);

    writeScanLog("[deps] 2 finding(s):", jsonVerboseControl);
    assert.deepEqual(stderr, ["[deps] 2 finding(s):"]);

    stderr.length = 0;
    writeScanLog("[deps] 2 finding(s):", tableControl);
    assert.match(stderr[0] ?? "", /\u001b\[93m\[deps\] 2 finding\(s\):\u001b\[0m/);
  } finally {
    console.error = originalError;
  }
});

test("dependency table output aggregates advisories per package version", () => {
  const findings: Finding[] = [
    {
      ruleId: "vulnerable-dependency",
      message: "Regular Expression Denial of Service (ReDoS) in lodash",
      filePath: "examples/deps/npm/runtime-app/package.json",
      line: 6,
      severity: "low",
      packageName: "lodash",
      packageVersion: "4.17.20",
      advisoryId: "GHSA-29mw-wpgm-hmr9",
      cveId: "CVE-2020-28500",
      fixedVersion: "4.17.21",
      remediation: "Upgrade to >= 4.17.21",
      kind: "dependency"
    },
    {
      ruleId: "vulnerable-dependency",
      message: "Prototype Pollution in lodash",
      filePath: "examples/deps/npm/runtime-app/package.json",
      line: 6,
      severity: "high",
      packageName: "lodash",
      packageVersion: "4.17.20",
      advisoryId: "GHSA-xxjr-mmjv-4gpg",
      cveId: "CVE-2021-23337",
      fixedVersion: "4.17.21",
      remediation: "Upgrade to >= 4.17.21",
      kind: "dependency"
    }
  ];

  const lines: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };

  try {
    printUnifiedFindings("deps", findings, "table", process.cwd());
  } finally {
    console.error = originalError;
  }

  const output = lines.join("\n");
  assert.match(output, /Package\s+Version\s+Fixed\s+CVE/);
  assert.match(output, /lodash\s+4\.17\.20\s+>= 4\.17\.21/);
  assert.match(output, /CVE-2021-23337, CVE-2020-28500/);
  assert.match(output, /2 known vulnerabilities/);
  assert.doesNotMatch(output, /Category/);
});

test("code table output omits dependency-specific columns", () => {
  const findings: Finding[] = [
    {
      ruleId: "no-eval",
      message: "Avoid eval()",
      filePath: "src/app.ts",
      line: 12,
      severity: "high"
    }
  ];

  const lines: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };

  try {
    printUnifiedFindings("code", findings, "table", process.cwd());
  } finally {
    console.error = originalError;
  }

  const output = lines.join("\n");
  assert.match(output, /Filename\s+Line\s+Rule/);
  assert.doesNotMatch(output, /Package\s+Version/);
});

test("dependency json output includes package, version, cve, and line fields", () => {
  const findings: Finding[] = [
    {
      ruleId: "vulnerable-dependency",
      message: "Prototype Pollution in minimist",
      filePath: "examples/deps/npm/runtime-app/package.json",
      line: 7,
      severity: "high",
      packageName: "minimist",
      packageVersion: "1.2.5",
      advisoryId: "GHSA-xvch-5gv4-984h",
      cveId: "CVE-2021-44906",
      fixedVersion: "1.2.6",
      remediation: "Upgrade to >= 1.2.6",
      kind: "dependency"
    }
  ];

  const lines: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };

  try {
    printUnifiedFindings("deps", findings, "json", process.cwd());
  } finally {
    console.log = originalLog;
  }

  const payload = JSON.parse(lines[0]);
  assert.equal(payload.package, "minimist");
  assert.equal(payload.version, "1.2.5");
  assert.equal(payload.fixed, ">= 1.2.6");
  assert.equal(payload.cve, "CVE-2021-44906");
  assert.deepEqual(payload.location, { line: 7 });
});

test("printScanWarnings writes structured warning records to stdout in json mode", () => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args: unknown[]) => {
    stdout.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    stderr.push(args.map(String).join(" "));
  };

  try {
    printScanWarnings(
      "deps",
      [
        {
          code: "deps.non-exact-spec",
          message: "Skipped non-exact requirements.txt dependency entries; no OSV lookup for unresolved ranges.",
          manifestPath: path.join(process.cwd(), "examples/deps/python/requirements-app/requirements.txt"),
          remediation: "Pin dependencies with == in requirements.txt or commit uv.lock, Pipfile.lock, or poetry.lock, then re-scan."
        }
      ],
      "json",
      process.cwd(),
      jsonControl
    );
    assert.deepEqual(stderr, []);
    assert.equal(stdout.length, 1);
    const payload = JSON.parse(stdout[0] ?? "");
    assert.equal(payload.category, "warning");
    assert.equal(payload.aspect, "deps");
    assert.equal(payload.code, "deps.non-exact-spec");
    assert.match(payload.filename, /requirements-app\/requirements\.txt$/);
    assert.ok(payload.remediation);
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
});

test("runScan json mode writes only JSON lines to stdout and stays quiet on stderr by default", async () => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args: unknown[]) => {
    stdout.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    stderr.push(args.map(String).join(" "));
  };

  try {
    const exitCode = await runScan({
      staged: false,
      paths: ["examples/deps/npm/runtime-app"],
      gitIgnoredPrefixes: ["examples/"],
      defaultAspects: ["code"],
      only: ["deps"],
      skip: [],
      secret: defaultSecretScanOptions(),
      deps: { ...defaultDepsScanOptions(), refresh: true },
      outputFormat: "json",
      quiet: false,
      verbose: false
    });

    assert.equal(exitCode, 1);
    assert.ok(stdout.length > 0);
    assert.equal(stderr.length, 0);
    for (const line of stdout) {
      const payload = JSON.parse(line);
      assert.ok(["dependency", "warning"].includes(payload.category));
      if (payload.category === "dependency") {
        assert.ok(payload.package);
      }
    }
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
});

test("runScan json mode includes deps warnings on stdout for unresolved python specs", async () => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args: unknown[]) => {
    stdout.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    stderr.push(args.map(String).join(" "));
  };

  try {
    const exitCode = await runScan({
      staged: false,
      paths: ["examples/deps/python/requirements-app"],
      gitIgnoredPrefixes: ["examples/"],
      defaultAspects: ["code"],
      only: ["deps"],
      skip: [],
      secret: defaultSecretScanOptions(),
      deps: { ...defaultDepsScanOptions(), refresh: true },
      outputFormat: "json",
      quiet: false,
      verbose: false
    });

    assert.equal(exitCode, 1);
    assert.equal(stderr.length, 0);
    assert.ok(stdout.some((line) => JSON.parse(line).category === "warning"));
    assert.ok(stdout.some((line) => JSON.parse(line).category === "dependency"));
    const warning = stdout.map((line) => JSON.parse(line)).find((payload) => payload.category === "warning");
    assert.equal(warning.code, "deps.non-exact-spec");
    assert.ok(warning.remediation);
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
});
