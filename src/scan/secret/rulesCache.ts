import path from "node:path";
import { loadSecretRules } from "./ruleLoader";
import { SecretRule, SecretScanOptions } from "./types";

const rulesByScan = new Map<string, Promise<SecretRule[]>>();

function secretScanCacheKey(workspace: string, options: SecretScanOptions): string {
  return JSON.stringify({
    workspace: path.resolve(workspace),
    rulePaths: [...options.rulePaths].sort(),
    defaultRules: options.defaultRules,
    defaultRulesVersion: options.defaultRulesVersion,
    rulesUpdateUrl: options.rulesUpdateUrl,
    rulesRefresh: options.rulesRefresh,
    rulesCacheTtlMs: options.rulesCacheTtlMs,
    entropyThreshold: options.entropyThreshold,
    minLength: options.minLength,
    minConfidence: options.minConfidence
  });
}

/** Clears in-memory secret rule memoization (for tests). */
export function clearSecretRulesScanCache(): void {
  rulesByScan.clear();
}

/**
 * Load secret rules once per (workspace, options) for a scan invocation.
 * Concurrent callers share the same in-flight promise.
 */
export function loadSecretRulesForScan(
  workspace: string,
  options: SecretScanOptions
): Promise<SecretRule[]> {
  const key = secretScanCacheKey(workspace, options);
  const cached = rulesByScan.get(key);
  if (cached) {
    return cached;
  }

  const pending = loadSecretRules(workspace, options);
  rulesByScan.set(key, pending);
  return pending.catch((error) => {
    rulesByScan.delete(key);
    throw error;
  });
}
