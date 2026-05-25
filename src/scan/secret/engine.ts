import { ConfidenceLevel, Finding } from "../../types";
import { confidenceWeight } from "./config";
import { findEntropySecrets } from "./entropy";
import { loadSecretRulesForScan } from "./rulesCache";
import { SecretEngineInput, SecretRule } from "./types";

function ruleRegex(pattern: string, caseInsensitive = false): RegExp {
  return new RegExp(pattern, caseInsensitive ? "gi" : "g");
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

        const regex = ruleRegex(pattern.value, pattern.caseInsensitive);
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

function locationKey(finding: Finding): string {
  return `${finding.filePath}:${finding.line}`;
}

function isRuleBasedSecret(finding: Finding): boolean {
  return finding.kind === "secret" && finding.ruleId !== "secret-high-entropy";
}

function isEntropySecret(finding: Finding): boolean {
  return finding.kind === "secret" && finding.ruleId === "secret-high-entropy";
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

function combineEvidence(left?: string, right?: string): string | undefined {
  const parts = [left, right].filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join("; ") : undefined;
}

function combineSecretFindings(left: Finding, right: Finding): Finding {
  const leftIsEntropy = isEntropySecret(left);
  const rightIsEntropy = isEntropySecret(right);
  const base = leftIsEntropy && !rightIsEntropy ? right : left;
  const extra = base === left ? right : left;

  let detectionMethod = base.detectionMethod ?? "rule";
  if (leftIsEntropy !== rightIsEntropy) {
    detectionMethod = "rule+entropy";
  } else if (detectionMethod === (extra.detectionMethod ?? detectionMethod)) {
    detectionMethod = base.detectionMethod ?? extra.detectionMethod ?? "rule";
  } else {
    detectionMethod = "rule+entropy";
  }

  return {
    ...base,
    severity: strongerSeverity(base.severity, extra.severity),
    confidence: strongerConfidence(base.confidence, extra.confidence),
    evidence: combineEvidence(base.evidence, extra.evidence),
    remediation: base.remediation ?? extra.remediation,
    detectionMethod
  };
}

function combineRuleWithEntropy(rule: Finding, entropy: Finding): Finding {
  return {
    ...rule,
    severity: strongerSeverity(rule.severity, entropy.severity),
    confidence: strongerConfidence(rule.confidence, entropy.confidence),
    evidence: combineEvidence(rule.evidence, entropy.evidence),
    remediation: rule.remediation ?? entropy.remediation,
    detectionMethod: "rule+entropy"
  };
}

function mergeFindings(findings: Finding[]): Finding[] {
  const ruleHitLocations = new Set<string>();
  for (const finding of findings) {
    if (isRuleBasedSecret(finding)) {
      ruleHitLocations.add(locationKey(finding));
    }
  }

  const entropyByLocation = new Map<string, Finding>();
  for (const finding of findings) {
    if (!isEntropySecret(finding)) {
      continue;
    }
    const loc = locationKey(finding);
    const existing = entropyByLocation.get(loc);
    entropyByLocation.set(loc, existing ? combineSecretFindings(existing, finding) : finding);
  }

  const merged = new Map<string, Finding>();

  for (const finding of findings) {
    if (isEntropySecret(finding) && ruleHitLocations.has(locationKey(finding))) {
      continue;
    }

    const key = findingKey(finding);
    let candidate = finding;
    const existing = merged.get(key);
    if (existing) {
      candidate = combineSecretFindings(existing, candidate);
    }

    if (isRuleBasedSecret(candidate)) {
      const entropy = entropyByLocation.get(locationKey(candidate));
      if (entropy) {
        candidate = combineRuleWithEntropy(candidate, entropy);
      }
    }

    merged.set(key, candidate);
  }

  return [...merged.values()];
}

export async function scanSecretFindings(input: SecretEngineInput): Promise<Finding[]> {
  const rules =
    input.rules ?? (await loadSecretRulesForScan(input.workspace, input.options));
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
