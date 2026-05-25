import fs from "node:fs";
import path from "node:path";
import { loadBuiltinSecretRules } from "./builtinRules";
import { loadRemoteRuleBundle } from "./remoteRules";
import {
  BUILTIN_SECRET_RULES_VERSION,
  SecretRule,
  SecretScanOptions
} from "./types";
import { parseRuleBundle } from "./yamlRuleParser";

function collectYamlFiles(entryPath: string, out: string[]): void {
  const stat = fs.statSync(entryPath);
  if (stat.isFile()) {
    if (/\.(?:ya?ml)$/i.test(entryPath)) {
      out.push(entryPath);
    }
    return;
  }

  for (const entry of fs.readdirSync(entryPath, { withFileTypes: true })) {
    collectYamlFiles(path.join(entryPath, entry.name), out);
  }
}

function loadRulesFromPaths(rulePaths: string[], workspace: string): SecretRule[] {
  const yamlFiles: string[] = [];
  for (const raw of rulePaths) {
    const absolute = path.isAbsolute(raw) ? raw : path.resolve(workspace, raw);
    if (!fs.existsSync(absolute)) {
      throw new Error(`Secret rule path not found: ${raw}`);
    }
    collectYamlFiles(absolute, yamlFiles);
  }

  const loaded: SecretRule[] = [];
  for (const filePath of yamlFiles.sort()) {
    loaded.push(...parseRuleBundle(fs.readFileSync(filePath, "utf8"), filePath, "custom"));
  }
  return loaded;
}

function dedupeRules(rules: SecretRule[]): SecretRule[] {
  const seen = new Set<string>();
  return rules.filter((rule) => {
    const key = `${rule.id}:${rule.sourceName}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export async function loadSecretRules(
  workspace: string,
  options: SecretScanOptions
): Promise<SecretRule[]> {
  const loaded: SecretRule[] = [];

  if (options.defaultRules) {
    if (
      options.defaultRulesVersion &&
      options.defaultRulesVersion !== BUILTIN_SECRET_RULES_VERSION
    ) {
      throw new Error(
        `Unknown built-in secret rule version: ${options.defaultRulesVersion} (available: ${BUILTIN_SECRET_RULES_VERSION})`
      );
    }
    loaded.push(...loadBuiltinSecretRules());
  }

  if (options.rulePaths.length > 0) {
    loaded.push(...loadRulesFromPaths(options.rulePaths, workspace));
  }

  if (options.rulesUpdateUrl) {
    const bundle = await loadRemoteRuleBundle(
      workspace,
      options.rulesUpdateUrl,
      options.rulesCacheTtlMs,
      options.rulesRefresh
    );
    loaded.push(...parseRuleBundle(bundle, options.rulesUpdateUrl, "remote"));
  }

  return dedupeRules(loaded);
}
