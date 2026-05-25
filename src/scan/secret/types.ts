import { ConfidenceLevel, Finding } from "../../types";

export const BUILTIN_SECRET_RULES_VERSION = "2026-05-25";
export const DEFAULT_SECRET_ENTROPY_THRESHOLD = 4.2;
export const DEFAULT_SECRET_MIN_LENGTH = 12;
export const DEFAULT_SECRET_RULES_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface SecretScanOptions {
  rulePaths: string[];
  defaultRules: boolean;
  defaultRulesVersion: string | null;
  rulesUpdateUrl: string | null;
  rulesRefresh: boolean;
  rulesCacheTtlMs: number;
  entropyThreshold: number;
  minLength: number;
  minConfidence: ConfidenceLevel;
}

export interface SecretRulePattern {
  type: "regex" | "literal";
  value: string;
  /** When true, compile pattern-regex with case-insensitive matching (Semgrep default is sensitive). */
  caseInsensitive?: boolean;
}

export interface SecretRule {
  id: string;
  description: string;
  message: string;
  severity: Finding["severity"];
  confidence: ConfidenceLevel;
  remediation?: string;
  patterns: SecretRulePattern[];
  source: "builtin" | "custom" | "remote";
  sourceName: string;
}

export interface SecretEngineInput {
  filePath: string;
  content: string;
  workspace: string;
  options: SecretScanOptions;
  /** When set, skips reloading rule bundles for each file in a batch scan. */
  rules?: SecretRule[];
}
