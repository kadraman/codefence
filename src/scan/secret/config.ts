import path from "node:path";
import { ConfidenceLevel } from "../../types";
import {
  DEFAULT_SECRET_ENTROPY_THRESHOLD,
  DEFAULT_SECRET_MIN_LENGTH,
  DEFAULT_SECRET_RULES_CACHE_TTL_MS,
  SecretScanOptions
} from "./types";

function envTrim(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

function parseBooleanSetting(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "on", "yes"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "off", "no"].includes(normalized)) {
    return false;
  }
  throw new Error(`Invalid boolean setting: ${value}`);
}

export function parseConfidenceLevel(value: string | undefined, defaultValue: ConfidenceLevel): ConfidenceLevel {
  if (!value) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "low" || normalized === "medium" || normalized === "high") {
    return normalized;
  }
  throw new Error(`Invalid confidence level: ${value}`);
}

export function confidenceWeight(value: ConfidenceLevel): number {
  if (value === "high") {
    return 3;
  }
  if (value === "medium") {
    return 2;
  }
  return 1;
}

export function parsePositiveNumber(
  value: string | undefined,
  defaultValue: number,
  label: string
): number {
  if (!value) {
    return defaultValue;
  }

  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive number`);
  }
  return parsed;
}

export function parseDurationMs(value: string | undefined, defaultValue: number): number {
  if (!value) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  const match = normalized.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)?$/);
  if (!match) {
    throw new Error(`Invalid duration: ${value}`);
  }

  const amount = Number.parseFloat(match[1]);
  const unit = match[2] ?? "ms";
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000
  };
  return amount * multipliers[unit];
}

export function parseSecretRulePaths(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(new RegExp(`[${path.delimiter === ";" ? ";," : ",:"}]`))
    .map((part) => part.trim())
    .filter(Boolean);
}

export function defaultSecretScanOptions(base: Partial<SecretScanOptions> = {}): SecretScanOptions {
  return {
    rulePaths:
      envTrim("CODEFENCE_SECRET_RULES") !== undefined
        ? parseSecretRulePaths(envTrim("CODEFENCE_SECRET_RULES"))
        : (base.rulePaths ?? []),
    defaultRules: parseBooleanSetting(envTrim("CODEFENCE_SECRET_DEFAULT_RULES"), base.defaultRules ?? true),
    defaultRulesVersion: envTrim("CODEFENCE_SECRET_DEFAULT_RULES_VERSION") ?? base.defaultRulesVersion ?? null,
    rulesUpdateUrl: envTrim("CODEFENCE_SECRET_RULES_UPDATE_URL") ?? base.rulesUpdateUrl ?? null,
    rulesRefresh: parseBooleanSetting(envTrim("CODEFENCE_SECRET_RULES_REFRESH"), base.rulesRefresh ?? false),
    rulesCacheTtlMs: parseDurationMs(
      envTrim("CODEFENCE_SECRET_RULES_CACHE_TTL"),
      base.rulesCacheTtlMs ?? DEFAULT_SECRET_RULES_CACHE_TTL_MS
    ),
    entropyThreshold: parsePositiveNumber(
      envTrim("CODEFENCE_SECRET_ENTROPY_THRESHOLD"),
      base.entropyThreshold ?? DEFAULT_SECRET_ENTROPY_THRESHOLD,
      "Secret entropy threshold"
    ),
    minLength: parsePositiveNumber(
      envTrim("CODEFENCE_SECRET_MIN_LENGTH"),
      base.minLength ?? DEFAULT_SECRET_MIN_LENGTH,
      "Secret minimum length"
    ),
    minConfidence: parseConfidenceLevel(envTrim("CODEFENCE_SECRET_MIN_CONFIDENCE"), base.minConfidence ?? "low")
  };
}
