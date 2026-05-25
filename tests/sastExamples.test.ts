import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { expandScanPaths, scanFiles } from "../src/scanner";

const examplesDir = path.join("examples", "java", "sast-vulnerabilities");
const sampleFile = path.join(examplesDir, "SastVulnerableSamples.java");

const expectedSastRuleIds = [
  "sast-sql-injection-jdbc-template",
  "sast-sql-injection-jdbc-statement",
  "sast-sql-injection-hibernate-native-query",
  "sast-sql-injection-hibernate-hql",
  "sast-sql-injection-jpa-create-native-query",
  "sast-sql-injection-jpa-create-query",
  "sast-xxe-document-builder-factory",
  "sast-xxe-transformer-factory",
  "sast-json-injection-jackson-write-raw",
  "sast-insecure-randomness-java-util-random",
  "sast-insecure-randomness-secure-random-constant-seed",
  "sast-cookie-security-httponly-not-set",
  "sast-cookie-security-secure-not-set",
  "sast-missing-csp-spring-security"
];

test("expandScanPaths walks SAST example directory", () => {
  const cwd = process.cwd();
  const expanded = expandScanPaths([examplesDir], cwd);
  assert.ok(expanded.some((file) => file.endsWith("SastVulnerableSamples.java")));
});

test("SAST Java examples trigger all sast-* rules", () => {
  const findings = scanFiles([path.resolve(sampleFile)]);
  const sastFindings = findings.filter((f) => f.ruleId.startsWith("sast-"));

  assert.equal(sastFindings.length, 22);

  for (const ruleId of expectedSastRuleIds) {
    assert.ok(
      sastFindings.some((f) => f.ruleId === ruleId),
      `expected finding for ${ruleId}`
    );
  }
});
