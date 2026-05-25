import fs from "node:fs";
import path from "node:path";
import { parseRuleBundle } from "./yamlRuleParser";
import { BUILTIN_SECRET_RULES_VERSION, SecretRule } from "./types";

export const BUILTIN_SECRET_RULES_BUNDLE = path.join("rules", "secret", "builtin.yml");

let cachedBuiltinRules: SecretRule[] | null = null;

export function resolveBuiltinRulesBundlePath(startDir: string = __dirname): string {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, BUILTIN_SECRET_RULES_BUNDLE);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    dir = path.dirname(dir);
  }

  throw new Error(
    `Built-in secret rules bundle not found (expected ${BUILTIN_SECRET_RULES_BUNDLE} under package root)`
  );
}

export function loadBuiltinSecretRules(): SecretRule[] {
  if (cachedBuiltinRules) {
    return cachedBuiltinRules;
  }

  const bundlePath = resolveBuiltinRulesBundlePath();
  const yamlContent = fs.readFileSync(bundlePath, "utf8");
  const sourceName = `builtin@${BUILTIN_SECRET_RULES_VERSION}`;
  const rules = parseRuleBundle(yamlContent, sourceName, "builtin");

  if (rules.length === 0) {
    throw new Error(`Built-in secret rules bundle is empty: ${bundlePath}`);
  }

  cachedBuiltinRules = rules;
  return rules;
}
