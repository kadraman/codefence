import assert from "node:assert/strict";
import test from "node:test";
import { queryOsvForDependencies } from "../src/scan/deps/provider";

test("queryOsvForDependencies normalizes findings from OSV batch response", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    ({
      ok: true,
      json: async () => ({
        results: [
          {
            vulns: [
              {
                id: "GHSA-xxxx-yyyy-zzzz",
                summary: "Prototype pollution in lodash",
                severity: [{ type: "CVSS_V3", score: "8.1" }],
                affected: [
                  {
                    ranges: [{ events: [{ fixed: "4.17.21" }] }]
                  }
                ]
              }
            ]
          }
        ]
      })
    }) as Response) as typeof fetch;

  try {
    const findings = await queryOsvForDependencies(
      [
        {
          ecosystem: "npm",
          name: "lodash",
          version: "4.17.20",
          manifestPath: "/tmp/workspace/package.json",
          manifestLine: 6
        }
      ],
      { providerUrl: "https://api.osv.dev/v1/querybatch", timeoutMs: 1000 }
    );

    assert.equal(findings.length, 1);
    assert.equal(findings[0].packageName, "lodash");
    assert.equal(findings[0].version, "4.17.20");
    assert.equal(findings[0].advisoryId, "GHSA-xxxx-yyyy-zzzz");
    assert.equal(findings[0].severity, "high");
    assert.equal(findings[0].fixedVersion, "4.17.21");
    assert.match(findings[0].remediation, /4\.17\.21/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

