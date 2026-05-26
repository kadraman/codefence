import assert from "node:assert/strict";
import test from "node:test";
import type { Finding } from "../src/types";
import { printUnifiedFindings } from "../src/scan/output";

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
