import { Finding } from "../../types";
import { SecretScanOptions } from "./types";

const GENERIC_ASSIGNMENT_REGEX =
  /\b(?:api[_-]?key|secret|token|access[_-]?token|client[_-]?secret|password)\b\s*[:=]\s*["']([^"'\\\n]{1,})["']/gi;

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
  if (entropy >= threshold + 0.8) {
    return "high";
  }
  if (entropy >= threshold + 0.3) {
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
      const value = match[1]?.trim();
      if (!value || value.length < options.minLength) {
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
        severity: entropy >= options.entropyThreshold + 0.6 ? "high" : "medium",
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
