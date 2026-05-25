import http from "node:http";
import https from "node:https";
import { isSecretRulesCacheFresh, readCachedSecretRules, writeCachedSecretRules } from "./cache";

const MAX_REDIRECTS = 5;
const DOWNLOAD_TIMEOUT_MS = 30_000;

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

function requestRuleBundle(
  url: string,
  redirectDepth = 0
): Promise<{ statusCode: number; body: string }> {
  if (redirectDepth > MAX_REDIRECTS) {
    return Promise.reject(new Error("Too many redirects while downloading secret rules"));
  }

  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;

    const req = lib.request(
      url,
      { method: "GET", timeout: DOWNLOAD_TIMEOUT_MS },
      (res) => {
        const statusCode = res.statusCode ?? 0;

        if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
          res.resume();
          const nextUrl = new URL(res.headers.location, url).href;
          resolve(requestRuleBundle(nextUrl, redirectDepth + 1));
          return;
        }

        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({ statusCode, body: Buffer.concat(chunks).toString("utf8") });
        });
        res.on("error", reject);
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error(`Timed out downloading secret rules from ${url}`));
    });
    req.on("error", reject);
    req.end();
  });
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

  const { statusCode, body } = await requestRuleBundle(url);
  if (statusCode < 200 || statusCode >= 300) {
    if (cached) {
      return cached.body;
    }
    throw new Error(`Failed to download remote secret rules: ${statusCode}`);
  }

  writeCachedSecretRules(workspace, url, body, ttlMs);
  return body;
}
