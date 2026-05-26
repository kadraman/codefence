import assert from "node:assert/strict";
import test from "node:test";
import { defaultDepsScanOptions } from "../src/scan/deps/config";
import { queryDependencies } from "../src/scan/deps/query";

test("queryDependencies uses OSV provider by default", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    ({
      ok: true,
      json: async () => ({ results: [{ vulns: [] }] })
    }) as Response) as typeof fetch;

  try {
    const findings = await queryDependencies(
      [
        {
          ecosystem: "npm",
          name: "lodash",
          version: "4.17.21",
          manifestPath: "/tmp/package.json",
          manifestLine: 3
        }
      ],
      defaultDepsScanOptions()
    );
    assert.deepEqual(findings, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("queryDependencies rejects custom provider until implemented", async () => {
  await assert.rejects(
    () =>
      queryDependencies(
        [
          {
            ecosystem: "npm",
            name: "lodash",
            version: "4.17.20",
            manifestPath: "/tmp/package.json",
            manifestLine: 3
          }
        ],
        {
          ...defaultDepsScanOptions(),
          provider: "custom",
          providerUrl: "https://vuln.example.com/api"
        }
      ),
    /Custom dependency providers are not implemented/
  );
});
