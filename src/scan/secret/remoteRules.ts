import { isSecretRulesCacheFresh, readCachedSecretRules, writeCachedSecretRules } from "./cache";

function validateRulesUrl(url: string): void {
  const parsed = new URL(url);
  if (parsed.protocol === "https:") {
    return;
  }

  if (
    parsed.protocol === "http:" &&
    (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost")
  ) {
    return;
  }

  throw new Error("Remote secret rules must use https (http is allowed only for localhost)");
}

export async function loadRemoteRuleBundle(
  workspace: string,
  url: string,
  ttlMs: number,
  refresh: boolean
): Promise<string> {
  validateRulesUrl(url);

  const cached = readCachedSecretRules(workspace, url);
  if (!refresh && cached && isSecretRulesCacheFresh(cached)) {
    return cached.body;
  }

  const response = await fetch(url);
  if (!response.ok) {
    if (cached) {
      return cached.body;
    }
    throw new Error(`Failed to download remote secret rules: ${response.status} ${response.statusText}`);
  }

  const body = await response.text();
  writeCachedSecretRules(workspace, url, body, ttlMs);
  return body;
}
