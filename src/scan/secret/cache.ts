import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cacheDir, ensureDir } from "../../hooks/paths";

interface CachedSecretRules {
  version: 1;
  url: string;
  fetchedAt: string;
  ttlMs: number;
  sha256: string;
  body: string;
}

function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function cacheFilePath(workspace: string, url: string): string {
  const key = crypto.createHash("sha256").update(url).digest("hex");
  return path.join(cacheDir(workspace), "secret-rules", `${key}.json`);
}

export function readCachedSecretRules(workspace: string, url: string): CachedSecretRules | null {
  const filePath = cacheFilePath(workspace, url);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const entry = JSON.parse(fs.readFileSync(filePath, "utf8")) as CachedSecretRules;
    if (entry.version !== 1 || entry.url !== url || hashContent(entry.body) !== entry.sha256) {
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

export function isSecretRulesCacheFresh(entry: CachedSecretRules, now = Date.now()): boolean {
  return new Date(entry.fetchedAt).getTime() + entry.ttlMs > now;
}

export function writeCachedSecretRules(
  workspace: string,
  url: string,
  body: string,
  ttlMs: number
): CachedSecretRules {
  const entry: CachedSecretRules = {
    version: 1,
    url,
    fetchedAt: new Date().toISOString(),
    ttlMs,
    sha256: hashContent(body),
    body
  };

  const filePath = cacheFilePath(workspace, url);
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), "utf8");
  return entry;
}
