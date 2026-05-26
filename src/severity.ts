/** Unified finding severity across code, secret, and dependency aspects. */
export type Severity = "low" | "medium" | "high" | "critical";

export const SEVERITY_RANK: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

export function strongerSeverity(left: Severity, right: Severity): Severity {
  return SEVERITY_RANK[left] >= SEVERITY_RANK[right] ? left : right;
}

const SEVERITY_LABELS = new Set<string>(["low", "medium", "high", "critical"]);

/** Normalize rule/YAML severity labels (including Semgrep ERROR/WARNING/INFO). */
export function normalizeRuleSeverity(value: unknown, defaultSeverity: Severity = "medium"): Severity {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (SEVERITY_LABELS.has(normalized)) {
    return normalized as Severity;
  }
  if (normalized === "info") {
    return "low";
  }
  if (normalized === "warning") {
    return "medium";
  }
  if (normalized === "error") {
    return "critical";
  }
  return defaultSeverity;
}

function hasSeverityLabel(text: string, label: string): boolean {
  return new RegExp(`\\b${label}\\b`, "i").test(text);
}

/** Infer severity from a CVSS vector string (OSV often returns these instead of a numeric score). */
export function severityFromCvssVector(vector: string): Severity | null {
  const trimmed = vector.trim();
  if (!/^CVSS:/i.test(trimmed)) {
    return null;
  }

  const impacts = ["C", "I", "A"]
    .map((code) => {
      const match = trimmed.match(new RegExp(`/${code}:([A-Z]+)`, "i"));
      return match ? match[1].toUpperCase() : null;
    })
    .filter((value): value is string => Boolean(value));

  if (impacts.length === 0) {
    return null;
  }

  const highCount = impacts.filter((value) => value === "H").length;
  if (highCount >= 2) {
    return "critical";
  }
  if (highCount >= 1) {
    return "high";
  }
  if (impacts.every((value) => value === "N" || value === "L")) {
    return "low";
  }
  return "medium";
}

/** Map OSV/CVSS severity strings and numeric scores to unified severity. */
export function severityFromOsvScore(score: string | undefined): Severity | null {
  if (!score) {
    return null;
  }

  const trimmed = score.trim();
  const normalized = trimmed.toLowerCase();

  if (hasSeverityLabel(normalized, "critical")) {
    return "critical";
  }
  if (hasSeverityLabel(normalized, "high")) {
    return "high";
  }
  if (hasSeverityLabel(normalized, "medium")) {
    return "medium";
  }
  if (hasSeverityLabel(normalized, "low")) {
    return "low";
  }

  const fromVector = severityFromCvssVector(trimmed);
  if (fromVector) {
    return fromVector;
  }

  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    return severityFromCvssValue(Number.parseFloat(trimmed));
  }

  const embeddedScores = [...normalized.matchAll(/\b(\d+(?:\.\d+)?)\b/g)]
    .map((match) => Number.parseFloat(match[1]))
    .filter((value) => value >= 4 && value <= 10);
  if (embeddedScores.length > 0) {
    return severityFromCvssValue(Math.max(...embeddedScores));
  }

  return null;
}

export function severityFromCvssValue(value: number): Severity {
  if (value >= 9) {
    return "critical";
  }
  if (value >= 7) {
    return "high";
  }
  if (value >= 4) {
    return "medium";
  }
  return "low";
}

/** Entropy heuristic severity from Shannon score relative to configured threshold. */
export function severityFromEntropy(entropy: number, threshold: number): Severity {
  if (entropy >= threshold + 1) {
    return "critical";
  }
  if (entropy >= threshold + 0.6) {
    return "high";
  }
  return "medium";
}
