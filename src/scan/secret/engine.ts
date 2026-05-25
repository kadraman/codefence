import { ConfidenceLevel, Finding } from "../../types";
import { confidenceWeight } from "./config";
import { findEntropySecrets } from "./entropy";
import { loadSecretRules } from "./ruleLoader";
import { SecretEngineInput, SecretRule } from "./types";

function ruleRegex(pattern: string): RegExp {
  return new RegExp(pattern, "gi");
}

function summarizeMatch(match: string): string {
  return `matched secret pattern (length=${match.length})`;
}

function buildRuleFindings(filePath: string, lines: string[], rules: SecretRule[]): Finding[] {
  const findings: Finding[] = [];

  lines.forEach((line, index) => {
    for (const rule of rules) {
      for (const pattern of rule.patterns) {
        if (pattern.type === "literal") {
          if (!line.includes(pattern.value)) {
            continue;
          }
          findings.push({
            ruleId: rule.id,
            message: rule.message,
            filePath,
            line: index + 1,
            severity: rule.severity,
            confidence: rule.confidence,
            evidence: `matched literal secret rule from ${rule.sourceName}`,
            remediation: rule.remediation,
            kind: "secret",
            detectionMethod: "rule"
          });
          continue;
        }

        const regex = ruleRegex(pattern.value);
        const match = regex.exec(line);
        if (!match) {
          continue;
        }

        findings.push({
          ruleId: rule.id,
          message: rule.message,
          filePath,
          line: index + 1,
          severity: rule.severity,
          confidence: rule.confidence,
          evidence: `${summarizeMatch(match[0])} via ${rule.sourceName}`,
          remediation: rule.remediation,
          kind: "secret",
          detectionMethod: "rule"
        });
      }
    }
  });

  return findings;
}

function findingKey(finding: Finding): string {
  return `${finding.filePath}:${finding.line}:${finding.ruleId}:${finding.message}`;
}

function strongerConfidence(a: ConfidenceLevel | undefined, b: ConfidenceLevel | undefined): ConfidenceLevel {
  const left = a ?? "low";
  const right = b ?? "low";
  return confidenceWeight(left) >= confidenceWeight(right) ? left : right;
}

function strongerSeverity(
  left: Finding["severity"],
  right: Finding["severity"]
): Finding["severity"] {
  const weights: Record<Finding["severity"], number> = { low: 1, medium: 2, high: 3 };
  return weights[left] >= weights[right] ? left : right;
}

function mergeFindings(findings: Finding[]): Finding[] {
  const merged = new Map<string, Finding>();

  for (const finding of findings) {
    if (
      finding.ruleId === "secret-high-entropy" &&
      findings.some(
        (other) =>
          other !== finding &&
          other.kind === "secret" &&
          other.ruleId !== "secret-high-entropy" &&
          other.filePath === finding.filePath &&
          other.line === finding.line
      )
    ) {
      continue;
    }

    const key = findingKey(finding);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, finding);
      continue;
    }

    merged.set(key, {
      ...existing,
      severity: strongerSeverity(existing.severity, finding.severity),
      confidence: strongerConfidence(existing.confidence, finding.confidence),
      evidence: existing.evidence ?? finding.evidence,
      remediation: existing.remediation ?? finding.remediation,
      detectionMethod:
        existing.detectionMethod === finding.detectionMethod
          ? existing.detectionMethod
          : "rule+entropy"
    });
  }

  return [...merged.values()];
}

export async function scanSecretFindings(input: SecretEngineInput): Promise<Finding[]> {
  const rules = await loadSecretRules(input.workspace, input.options);
  const lines = input.content.split(/\r?\n/);
  const ruleFindings = buildRuleFindings(input.filePath, lines, rules);
  const entropyFindings = findEntropySecrets(input.filePath, lines, input.options);
  const merged = mergeFindings([...ruleFindings, ...entropyFindings]);

  return merged.filter(
    (finding) =>
      finding.kind !== "secret" ||
      confidenceWeight(finding.confidence ?? "low") >= confidenceWeight(input.options.minConfidence)
  );
}
