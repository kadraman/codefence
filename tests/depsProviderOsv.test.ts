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
      { providerUrl: "https://api.osv.dev/v1/querybatch", timeoutMs: 1000, http2Mode: "auto" }
    );

    assert.equal(findings.length, 1);
    assert.equal(findings[0].packageName, "lodash");
    assert.equal(findings[0].version, "4.17.20");
    assert.equal(findings[0].advisoryId, "GHSA-xxxx-yyyy-zzzz");
    assert.equal(findings[0].severity, "high");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("queryOsvForDependencies maps CVSS 9+ to critical severity", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    ({
      ok: true,
      json: async () => ({
        results: [
          {
            vulns: [
              {
                id: "GHSA-critical-example",
                summary: "Critical example",
                severity: [{ type: "CVSS_V3", score: "9.8" }],
                affected: [{ ranges: [{ events: [{ fixed: "2.0.0" }] }] }]
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
          name: "pkg",
          version: "1.0.0",
          manifestPath: "/tmp/package.json",
          manifestLine: 1
        }
      ],
      { providerUrl: "https://api.osv.dev/v1/querybatch", timeoutMs: 1000, http2Mode: "auto" }
    );

    assert.equal(findings[0].severity, "critical");
    assert.equal(findings[0].fixedVersion, "2.0.0");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("queryOsvForDependencies skips per-advisory GET when batch includes full vuln records", async () => {
  const originalFetch = globalThis.fetch;
  const vulnDetailUrls: string[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/vulns/")) {
      vulnDetailUrls.push(url);
    }
    return {
      ok: true,
      json: async () => ({
        results: [
          {
            vulns: [
              {
                id: "GHSA-xxxx-yyyy-zzzz",
                summary: "Prototype pollution in lodash",
                aliases: ["CVE-2020-28500"],
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
    } as Response;
  }) as typeof fetch;

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
      { providerUrl: "https://api.osv.dev/v1/querybatch", timeoutMs: 1000, http2Mode: "auto" }
    );

    assert.equal(findings.length, 1);
    assert.equal(findings[0].cveId, "CVE-2020-28500");
    assert.equal(vulnDetailUrls.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("queryOsvForDependencies enriches stub batch vulns via GET with deduped ids", async () => {
  const originalFetch = globalThis.fetch;
  const vulnDetailUrls: string[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/querybatch")) {
      return {
        ok: true,
        json: async () => ({
          results: [
            {
              vulns: [
                { id: "GHSA-aaaa-bbbb-cccc" },
                { id: "GHSA-aaaa-bbbb-cccc" }
              ]
            }
          ]
        })
      } as Response;
    }
    if (url.includes("/vulns/GHSA-aaaa-bbbb-cccc")) {
      vulnDetailUrls.push(url);
      return {
        ok: true,
        json: async () => ({
          id: "GHSA-aaaa-bbbb-cccc",
          summary: "Example vulnerability",
          aliases: ["CVE-2024-0001"],
          affected: [{ ranges: [{ events: [{ fixed: "2.0.0" }] }] }]
        })
      } as Response;
    }
    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;

  try {
    const findings = await queryOsvForDependencies(
      [
        {
          ecosystem: "npm",
          name: "pkg-a",
          version: "1.0.0",
          manifestPath: "/tmp/package.json",
          manifestLine: 3
        }
      ],
      { providerUrl: "https://api.osv.dev/v1/querybatch", timeoutMs: 1000, http2Mode: "auto" }
    );

    assert.equal(findings.length, 2);
    assert.equal(vulnDetailUrls.length, 1);
    assert.equal(findings[0].summary, "Example vulnerability");
    assert.equal(findings[0].cveId, "CVE-2024-0001");
    assert.equal(findings[0].fixedVersion, "2.0.0");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

