import { severityFromEntropy } from "../../severity";
import { Finding } from "../../types";
import { SecretScanOptions } from "./types";

const GENERIC_ASSIGNMENT_REGEX =
  /\b([A-Za-z_][A-Za-z0-9_-]{1,64})\b\s*[:=]\s*["']([^"'\\\n]{1,})["']/g;
const BENIGN_ASSIGNMENT_KEYS = new Set([
  "name",
  "version",
  "path",
  "url",
  "host",
  "port",
  "image",
  "sha",
  "digest",
  "color"
]);

function shannonEntropy(input: string): number {
  const counts = new Map<string, number>();
  for (const char of input) {
    counts.set(char, (counts.get(char) ?? 0) + 1);
  }

  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / input.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function inferEntropyConfidence(entropy: number, threshold: number): "low" | "medium" | "high" {
  if (entropy >= threshold + 0.6) {
    return "high";
  }
  if (entropy >= threshold) {
    return "medium";
  }
  return "low";
}

export function findEntropySecrets(
  filePath: string,
  lines: string[],
  options: SecretScanOptions
): Finding[] {
  const findings: Finding[] = [];

  lines.forEach((line, index) => {
    for (const match of line.matchAll(GENERIC_ASSIGNMENT_REGEX)) {
      const key = match[1]?.trim().toLowerCase();
      const value = match[2]?.trim();
      if (!value || value.length < options.minLength) {
        continue;
      }
      if (key && BENIGN_ASSIGNMENT_KEYS.has(key)) {
        continue;
      }

      const entropy = shannonEntropy(value);
      if (entropy < options.entropyThreshold) {
        continue;
      }

      findings.push({
        ruleId: "secret-high-entropy",
        message: "Potential hardcoded secret detected via entropy heuristic",
        filePath,
        line: index + 1,
        severity: severityFromEntropy(entropy, options.entropyThreshold),
        confidence: inferEntropyConfidence(entropy, options.entropyThreshold),
        evidence: `token-like string length=${value.length} entropy=${entropy.toFixed(2)}`,
        remediation: "Move secret-like values into environment variables or a secret manager.",
        kind: "secret",
        detectionMethod: "entropy"
      });
    }
  });

  return findings;
}
