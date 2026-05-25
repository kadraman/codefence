import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { clearSecretRulesScanCache } from "../src/scan/secret/rulesCache";
import { scanFiles } from "../src/scanner";

test("scanFiles loads remote secret rules once across parallel file scans", async () => {
  clearSecretRulesScanCache();

  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-scan-batch-"));
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-scan-files-"));
  let requests = 0;
  const yaml = `rules:
  - id: batch-remote-secret
    message: Batch remote secret detected
    severity: high
    metadata:
      confidence: medium
    pattern-regex: "\\\\bbatch_[A-Za-z0-9]{8}\\\\b"
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
  const files = ["a.ts", "b.ts", "c.ts"].map((name) => {
    const filePath = path.join(tmpDir, name);
    fs.writeFileSync(filePath, 'const token = "batch_abcdefgh";\n', "utf8");
    return filePath;
  });

  await scanFiles(files, {
    workspace,
    secret: {
      rulePaths: [],
      defaultRules: false,
      defaultRulesVersion: null,
      rulesUpdateUrl: url,
      rulesRefresh: true,
      rulesCacheTtlMs: 60_000,
      entropyThreshold: 4.2,
      minLength: 12,
      minConfidence: "low"
    }
  });

  assert.equal(requests, 1);

  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  fs.rmSync(workspace, { recursive: true, force: true });
  fs.rmSync(tmpDir, { recursive: true, force: true });
  clearSecretRulesScanCache();
});
