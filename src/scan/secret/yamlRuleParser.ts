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

function parseCaseInsensitiveFlag(value: unknown): boolean {
  return value === true || value === "true";
}

function ruleCaseInsensitive(rule: Record<string, unknown>, metadata: Record<string, unknown>): boolean {
  const options = (rule.options ?? {}) as Record<string, unknown>;
  if (parseCaseInsensitiveFlag(options.generic_caseless)) {
    return true;
  }
  if (options.case_sensitive === false) {
    return true;
  }
  return (
    parseCaseInsensitiveFlag(metadata["case-insensitive"]) ||
    parseCaseInsensitiveFlag(metadata.case_insensitive)
  );
}

function collectPatterns(node: unknown, caseInsensitive = false): SecretRulePattern[] {
  if (!node || typeof node !== "object") {
    return [];
  }

  const entry = node as Record<string, unknown>;
  const patterns: SecretRulePattern[] = [];

  if (typeof entry["pattern-regex"] === "string") {
    patterns.push({ type: "regex", value: entry["pattern-regex"], caseInsensitive });
  }

  if (typeof entry.pattern === "string") {
    patterns.push({ type: "literal", value: entry.pattern });
  }

  if (Array.isArray(entry.patterns)) {
    for (const child of entry.patterns) {
      patterns.push(...collectPatterns(child, caseInsensitive));
    }
  }

  if (Array.isArray(entry["pattern-either"])) {
    for (const child of entry["pattern-either"]) {
      patterns.push(...collectPatterns(child, caseInsensitive));
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
  const patterns = collectPatterns(rule, ruleCaseInsensitive(rule, metadata));
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
