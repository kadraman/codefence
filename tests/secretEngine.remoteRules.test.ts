import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadSecretRules } from "../src/scan/secret/ruleLoader";

test("loadSecretRules rejects redirect to non-localhost http", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-remote-redirect-"));

  const server = http.createServer((req, res) => {
    if (req.url === "/rules.yml") {
      res.writeHead(302, { Location: "http://example.com/evil-rules.yml" });
      res.end();
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("failed to start test server");
  }

  const url = `http://127.0.0.1:${address.port}/rules.yml`;

  await assert.rejects(
    () =>
      loadSecretRules(workspace, {
        rulePaths: [],
        defaultRules: false,
        defaultRulesVersion: null,
        rulesUpdateUrl: url,
        rulesRefresh: true,
        rulesCacheTtlMs: 60_000,
        entropyThreshold: 4.2,
        minLength: 12,
        minConfidence: "low"
      }),
    /Remote secret rules must use https/
  );

  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  fs.rmSync(workspace, { recursive: true, force: true });
});

test("loadSecretRules follows redirect to localhost http", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-remote-redirect-ok-"));
  const yaml = `rules:
  - id: redirected-secret
    message: Redirected secret detected
    severity: high
    metadata:
      confidence: medium
    pattern-regex: "\\\\bredirected_[A-Za-z0-9]{8}\\\\b"
`;

  let targetPort = 0;
  const targetServer = http.createServer((_, res) => {
    res.writeHead(200, { "content-type": "application/x-yaml" });
    res.end(yaml);
  });

  await new Promise<void>((resolve) =>
    targetServer.listen(0, "127.0.0.1", () => {
      const address = targetServer.address();
      if (!address || typeof address === "string") {
        throw new Error("failed to start target server");
      }
      targetPort = address.port;
      resolve();
    })
  );

  const redirectServer = http.createServer((req, res) => {
    if (req.url === "/rules.yml") {
      res.writeHead(302, { Location: `http://127.0.0.1:${targetPort}/bundle.yml` });
      res.end();
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => redirectServer.listen(0, "127.0.0.1", () => resolve()));
  const redirectAddress = redirectServer.address();
  if (!redirectAddress || typeof redirectAddress === "string") {
    throw new Error("failed to start redirect server");
  }

  const url = `http://127.0.0.1:${redirectAddress.port}/rules.yml`;
  const rules = await loadSecretRules(workspace, {
    rulePaths: [],
    defaultRules: false,
    defaultRulesVersion: null,
    rulesUpdateUrl: url,
    rulesRefresh: true,
    rulesCacheTtlMs: 60_000,
    entropyThreshold: 4.2,
    minLength: 12,
    minConfidence: "low"
  });

  assert.equal(rules[0]?.id, "redirected-secret");

  await new Promise<void>((resolve, reject) =>
    redirectServer.close((error) => (error ? reject(error) : resolve()))
  );
  await new Promise<void>((resolve, reject) =>
    targetServer.close((error) => (error ? reject(error) : resolve()))
  );
  fs.rmSync(workspace, { recursive: true, force: true });
});
