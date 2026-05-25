import { parseAllDocuments } from "yaml";
import { ConfidenceLevel } from "../../types";
import { SecretRule, SecretRulePattern } from "./types";

function normalizeSeverity(value: unknown): "low" | "medium" | "high" {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "medium";
  if (normalized === "low" || normalized === "medium" || normalized === "high") {
    return normalized;
  }
  if (normalized === "warning") {
    return "medium";
  }
  if (normalized === "error") {
    return "high";
  }
  return "medium";
}

function normalizeConfidence(value: unknown): ConfidenceLevel {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "medium";
  if (normalized === "low" || normalized === "medium" || normalized === "high") {
    return normalized;
  }
  return "medium";
}

function collectPatterns(node: unknown): SecretRulePattern[] {
  if (!node || typeof node !== "object") {
    return [];
  }

  const entry = node as Record<string, unknown>;
  const patterns: SecretRulePattern[] = [];

  if (typeof entry["pattern-regex"] === "string") {
    patterns.push({ type: "regex", value: entry["pattern-regex"] });
  }

  if (typeof entry.pattern === "string") {
    patterns.push({ type: "literal", value: entry.pattern });
  }

  if (Array.isArray(entry.patterns)) {
    for (const child of entry.patterns) {
      patterns.push(...collectPatterns(child));
    }
  }

  if (Array.isArray(entry["pattern-either"])) {
    for (const child of entry["pattern-either"]) {
      patterns.push(...collectPatterns(child));
    }
  }

  return patterns;
}

function parseRuleObject(
  rawRule: unknown,
  sourceName: string,
  source: SecretRule["source"]
): SecretRule | null {
  if (!rawRule || typeof rawRule !== "object") {
    return null;
  }

  const rule = rawRule as Record<string, unknown>;
  const id = typeof rule.id === "string" ? rule.id.trim() : "";
  const message = typeof rule.message === "string" ? rule.message.trim() : "";
  if (!id || !message) {
    return null;
  }

  const metadata = (rule.metadata ?? {}) as Record<string, unknown>;
  const patterns = collectPatterns(rule);
  if (patterns.length === 0) {
    return null;
  }

  for (const pattern of patterns) {
    if (pattern.type === "regex") {
      try {
        new RegExp(pattern.value);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid regex in secret rule ${id} from ${sourceName}: ${message}`);
      }
    }
  }

  return {
    id,
    description: typeof rule.description === "string" ? rule.description : id,
    message,
    severity: normalizeSeverity(rule.severity),
    confidence: normalizeConfidence(metadata.confidence),
    remediation:
      typeof metadata.remediation === "string"
        ? metadata.remediation
        : typeof metadata["remediation-guidance"] === "string"
          ? metadata["remediation-guidance"]
          : undefined,
    patterns,
    source,
    sourceName
  };
}

export function parseRuleBundle(
  yamlContent: string,
  sourceName: string,
  source: SecretRule["source"]
): SecretRule[] {
  const rules: SecretRule[] = [];

  for (const doc of parseAllDocuments(yamlContent)) {
    const value = doc.toJSON() as Record<string, unknown> | null;
    if (!value || !Array.isArray(value.rules)) {
      continue;
    }

    for (const rawRule of value.rules) {
      const parsed = parseRuleObject(rawRule, sourceName, source);
      if (parsed) {
        rules.push(parsed);
      }
    }
  }

  return rules;
}
