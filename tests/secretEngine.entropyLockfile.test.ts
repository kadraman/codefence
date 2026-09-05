import assert from "node:assert/strict";
import test from "node:test";
import { scanSecretFindings } from "../src/scan/secret/engine";
import { defaultSecretScanOptions } from "../src/scan/secret/config";

// Split so this file itself does not trip staged secret/entropy scanning.
const HIGH_ENTROPY_SAMPLE = ["Q4z8vB2n", "Lp9sTw7x", "Yk3mHc6r", "Jd1f"].join("");

test("entropy heuristic skips Cargo.lock source and checksum metadata", async () => {
  const content = [
    "[[package]]",
    'name = "serde"',
    'version = "1.0.188"',
    'source = "registry+https://github.com/rust-lang/crates.io-index"',
    // Hex checksum split across concat so the test file is not flagged.
    `checksum = "${["670ad68c", "90886c1c", "bcb8bb9e", "ccc68dd8", "f16ba07f", "caf7ee3c", "8e7be808", "7b5a5556"].join("")}"`,
    ""
  ].join("\n");

  const findings = await scanSecretFindings({
    filePath: "Cargo.lock",
    content,
    workspace: process.cwd(),
    options: defaultSecretScanOptions()
  });

  assert.equal(
    findings.filter((finding) => finding.ruleId === "secret-high-entropy").length,
    0
  );
});

test("entropy heuristic skips lockfile integrity/hash keys and URL values", async () => {
  const content = [
    'resolved = "https://registry.npmjs.org/lodash/-/lodash-4.17.20.tgz"',
    `integrity = "sha512-${["abc123DE", "F456ghi7", "89JKLmno", "pqrstuvw", "xyz01234", "56789ABC", "DEF"].join("")}"`,
    `hash = "sha512-${["9f86d012", "3456789a", "bcdefABC", "DEF01234", "56789abc", "defABCDE", "F0123456", "789abcd"].join("")}"`,
    // Neutral key: entropy-only (avoid secret-key rule matches like token/api_secret).
    `entropyBlob = "${HIGH_ENTROPY_SAMPLE}"`,
    ""
  ].join("\n");

  const findings = await scanSecretFindings({
    filePath: "lock-metadata.toml",
    content,
    workspace: process.cwd(),
    options: defaultSecretScanOptions()
  });

  const entropyFindings = findings.filter((finding) => finding.ruleId === "secret-high-entropy");
  assert.equal(entropyFindings.length, 1);
  assert.match(entropyFindings[0]?.evidence ?? "", /entropy=/);
});

test("entropy heuristic still flags unknown high-entropy assignments", async () => {
  const content = `entropyBlob = "${HIGH_ENTROPY_SAMPLE}"\n`;
  const findings = await scanSecretFindings({
    filePath: "config.toml",
    content,
    workspace: process.cwd(),
    options: defaultSecretScanOptions()
  });

  assert.ok(findings.some((finding) => finding.ruleId === "secret-high-entropy"));
});

test("entropy heuristic skips bare https values even for unknown keys", async () => {
  const content = `mirror = "https://example.com/crates/index-with-mixed-CHARS-0123456789"\n`;
  const findings = await scanSecretFindings({
    filePath: "config.toml",
    content,
    workspace: process.cwd(),
    options: defaultSecretScanOptions()
  });

  assert.equal(
    findings.filter((finding) => finding.ruleId === "secret-high-entropy").length,
    0
  );
});
