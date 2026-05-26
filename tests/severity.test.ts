import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeRuleSeverity,
  severityFromCvssValue,
  severityFromCvssVector,
  severityFromEntropy,
  severityFromOsvScore,
  strongerSeverity
} from "../src/severity";

test("severityFromCvssValue maps CVSS bands to four levels", () => {
  assert.equal(severityFromCvssValue(9), "critical");
  assert.equal(severityFromCvssValue(8.9), "high");
  assert.equal(severityFromCvssValue(7), "high");
  assert.equal(severityFromCvssValue(4), "medium");
  assert.equal(severityFromCvssValue(3.9), "low");
});

test("severityFromOsvScore parses labels and embedded CVSS numbers", () => {
  assert.equal(severityFromOsvScore("CRITICAL"), "critical");
  assert.equal(severityFromOsvScore("HIGH"), "high");
  assert.equal(severityFromOsvScore("CVSS_V3 9.8"), "critical");
  assert.equal(severityFromOsvScore("7.5"), "high");
  assert.equal(severityFromOsvScore("following"), null);
});

test("severityFromCvssVector maps OSV CVSS impact metrics", () => {
  assert.equal(
    severityFromCvssVector("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"),
    "critical"
  );
  assert.equal(
    severityFromCvssVector("CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:L/A:N"),
    "high"
  );
  assert.equal(
    severityFromCvssVector("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N"),
    "low"
  );
});

test("normalizeRuleSeverity maps Semgrep severities and passes through labels", () => {
  assert.equal(normalizeRuleSeverity("ERROR"), "critical");
  assert.equal(normalizeRuleSeverity("WARNING"), "medium");
  assert.equal(normalizeRuleSeverity("INFO"), "low");
  assert.equal(normalizeRuleSeverity("critical"), "critical");
});

test("strongerSeverity picks the higher rank", () => {
  assert.equal(strongerSeverity("high", "critical"), "critical");
  assert.equal(strongerSeverity("low", "medium"), "medium");
});

test("severityFromEntropy escalates with higher Shannon scores", () => {
  const threshold = 4.2;
  assert.equal(severityFromEntropy(threshold, threshold), "medium");
  assert.equal(severityFromEntropy(threshold + 0.6, threshold), "high");
  assert.equal(severityFromEntropy(threshold + 1, threshold), "critical");
});
