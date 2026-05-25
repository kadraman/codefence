import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { scanFiles } from "../src/scanner";

test("examples remote bundle adds deploy-token and header findings", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-remote-example-"));
  const bundlePath = path.join(process.cwd(), "examples", "rules", "extra-secrets-bundle.yml");
  const fixture = path.join(process.cwd(), "examples", "secrets", "fake-secrets.ts");
  const bundleBody = fs.readFileSync(bundlePath, "utf8");

  const server = http.createServer((_, res) => {
    res.writeHead(200, { "content-type": "application/x-yaml" });
    res.end(bundleBody);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("failed to start test server");
  }

  const url = `http://127.0.0.1:${address.port}/extra-secrets-bundle.yml`;
  const findings = await scanFiles([fixture], {
    workspace,
    secret: {
      rulePaths: [],
      defaultRules: true,
      defaultRulesVersion: null,
      rulesUpdateUrl: url,
      rulesRefresh: true,
      rulesCacheTtlMs: 60_000,
      entropyThreshold: 4.2,
      minLength: 12,
      minConfidence: "low"
    }
  });

  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));

  assert.ok(findings.some((f) => f.ruleId === "example-ci-deploy-token"));
  assert.ok(findings.some((f) => f.ruleId === "example-internal-api-header"));

  fs.rmSync(workspace, { recursive: true, force: true });
});
