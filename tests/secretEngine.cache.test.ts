import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  isSecretRulesCacheFresh,
  readCachedSecretRules,
  writeCachedSecretRules
} from "../src/scan/secret/cache";
import { loadSecretRules } from "../src/scan/secret/ruleLoader";

test("isSecretRulesCacheFresh honors current ttlMs not stored ttlMs", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-cache-ttl-"));
  const url = "http://127.0.0.1:9/rules.yml";
  const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString();

  writeCachedSecretRules(workspace, url, "rules:\n  - id: x\n    message: m\n", 86_400_000, {
    fetchedAt: twoHoursAgo
  });

  const cached = readCachedSecretRules(workspace, url);
  assert.ok(cached);
  assert.equal(isSecretRulesCacheFresh(cached, 86_400_000), true);
  assert.equal(isSecretRulesCacheFresh(cached, 3_600_000), false);

  fs.rmSync(workspace, { recursive: true, force: true });
});

test("loadSecretRules refreshes remote bundles and falls back to cache", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-remote-rules-"));
  let requests = 0;
  const yaml = `rules:
  - id: remote-secret
    message: Remote secret detected
    severity: high
    metadata:
      confidence: medium
    pattern-regex: "\\\\bremote_[A-Za-z0-9]{12}\\\\b"
`;

  const server = http.createServer((_, res) => {
    requests++;
    res.writeHead(200, { "content-type": "application/x-yaml" });
    res.end(yaml);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("failed to start test server");
  }

  const url = `http://127.0.0.1:${address.port}/rules.yml`;
  const options = {
    rulePaths: [],
    defaultRules: false,
    defaultRulesVersion: null,
    rulesUpdateUrl: url,
    rulesRefresh: false,
    rulesCacheTtlMs: 60_000,
    entropyThreshold: 4.2,
    minLength: 12,
    minConfidence: "low" as const
  };

  const first = await loadSecretRules(workspace, options);
  assert.equal(first[0]?.id, "remote-secret");
  assert.equal(requests, 1);

  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));

  const second = await loadSecretRules(workspace, options);
  assert.equal(second[0]?.id, "remote-secret");
  assert.equal(requests, 1);

  fs.rmSync(workspace, { recursive: true, force: true });
});

test("loadSecretRules re-fetches when a shorter cache ttl is requested", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-cache-ttl-fetch-"));
  let requests = 0;
  const yaml = `rules:
  - id: remote-secret
    message: Remote secret detected
    severity: high
    metadata:
      confidence: medium
    pattern-regex: "\\\\bremote_[A-Za-z0-9]{12}\\\\b"
`;

  const server = http.createServer((_, res) => {
    requests++;
    res.writeHead(200, { "content-type": "application/x-yaml" });
    res.end(yaml);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("failed to start test server");
  }

  const url = `http://127.0.0.1:${address.port}/rules.yml`;
  const longTtlOptions = {
    rulePaths: [],
    defaultRules: false,
    defaultRulesVersion: null,
    rulesUpdateUrl: url,
    rulesRefresh: false,
    rulesCacheTtlMs: 86_400_000,
    entropyThreshold: 4.2,
    minLength: 12,
    minConfidence: "low" as const
  };

  await loadSecretRules(workspace, longTtlOptions);
  assert.equal(requests, 1);

  const cached = readCachedSecretRules(workspace, url);
  assert.ok(cached);
  writeCachedSecretRules(workspace, url, cached.body, cached.ttlMs, {
    fetchedAt: new Date(Date.now() - 2 * 3_600_000).toISOString()
  });

  await loadSecretRules(workspace, {
    ...longTtlOptions,
    rulesCacheTtlMs: 3_600_000
  });
  assert.equal(requests, 2);

  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  fs.rmSync(workspace, { recursive: true, force: true });
});
