import { severityFromOsvScore } from "../../severity";
import { depsFetch } from "./httpClient";
import { DepsFinding, DependencyCoordinate, DepsHttp2Mode } from "./types";

const QUERY_BATCH_LIMIT = 100;
const RETRY_DELAYS_MS = [0, 300];
const VULN_DETAIL_CONCURRENCY = 8;

interface OsvPackage {
  ecosystem?: string;
  name?: string;
}

interface OsvAffectedRangeEvent {
  fixed?: string;
}

interface OsvAffectedRange {
  events?: OsvAffectedRangeEvent[];
}

interface OsvAffected {
  ranges?: OsvAffectedRange[];
  package?: OsvPackage;
  database_specific?: {
    severity?: string;
  };
  ecosystem_specific?: {
    severity?: string;
  };
}

interface OsvVulnerability {
  id?: string;
  summary?: string;
  details?: string;
  aliases?: string[];
  severity?: Array<{
    type?: string;
    score?: string;
  }>;
  affected?: OsvAffected[];
}

interface OsvBatchResult {
  vulns?: OsvVulnerability[];
}

interface OsvBatchResponse {
  results?: OsvBatchResult[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickSeverity(vuln: OsvVulnerability): DepsFinding["severity"] {
  for (const affected of vuln.affected ?? []) {
    const sev = severityFromOsvScore(
      affected.database_specific?.severity ?? affected.ecosystem_specific?.severity
    );
    if (sev) {
      return sev;
    }
  }

  for (const score of vuln.severity ?? []) {
    const sev = severityFromOsvScore(score.score);
    if (sev) {
      return sev;
    }
  }

  return "medium";
}

function pickFixedVersion(vuln: OsvVulnerability): string | null {
  for (const affected of vuln.affected ?? []) {
    for (const range of affected.ranges ?? []) {
      for (const event of range.events ?? []) {
        if (event.fixed?.trim()) {
          return event.fixed.trim();
        }
      }
    }
  }

  return null;
}

function pickCveId(vuln: OsvVulnerability): string | null {
  for (const alias of vuln.aliases ?? []) {
    if (alias.startsWith("CVE-")) {
      return alias;
    }
  }
  return null;
}

function pickRemediation(fixedVersion: string | null): string {
  if (fixedVersion) {
    return `Upgrade to >= ${fixedVersion}`;
  }

  return "Upgrade to a patched version";
}

function normalizeVulnerability(
  dep: DependencyCoordinate,
  vuln: OsvVulnerability
): DepsFinding {
  const advisoryId = vuln.id?.trim() || "OSV-UNKNOWN";
  const fixedVersion = pickFixedVersion(vuln);
  return {
    packageName: dep.name,
    version: dep.version,
    advisoryId,
    cveId: pickCveId(vuln),
    summary: vuln.summary?.trim() || vuln.details?.trim() || "Known vulnerability detected in dependency version",
    severity: pickSeverity(vuln),
    remediation: pickRemediation(fixedVersion),
    fixedVersion,
    manifestPath: dep.manifestPath,
    manifestLine: dep.manifestLine
  };
}

function providerBaseUrl(providerUrl: string): string {
  return providerUrl.replace(/\/querybatch\/?$/, "");
}

/** Batch responses are often stubs (id only); skip GET when we already have enough to report. */
function vulnerabilityNeedsDetails(vuln: OsvVulnerability): boolean {
  if (!vuln.summary?.trim() && !vuln.details?.trim()) {
    return true;
  }
  if (pickFixedVersion(vuln) === null) {
    return true;
  }
  if (pickCveId(vuln) === null) {
    return true;
  }
  return false;
}

function mergeVulnerability(stub: OsvVulnerability, details: OsvVulnerability | null): OsvVulnerability {
  if (!details) {
    return stub;
  }
  return {
    ...stub,
    ...details,
    id: stub.id ?? details.id
  };
}

async function fetchGetWithRetry<T>(
  url: string,
  timeoutMs: number,
  http2Mode: DepsHttp2Mode
): Promise<T | null> {
  let lastError: unknown;

  for (const delayMs of RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await sleep(delayMs);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await depsFetch(url, http2Mode, {
        method: "GET",
        headers: { accept: "application/json" },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Provider request failed: ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  return null;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) {
        return;
      }
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

async function loadVulnerabilityDetails(
  advisoryIds: string[],
  options: { providerUrl: string; timeoutMs: number; http2Mode: DepsHttp2Mode }
): Promise<Map<string, OsvVulnerability>> {
  const baseUrl = providerBaseUrl(options.providerUrl);
  const details = new Map<string, OsvVulnerability>();

  const fetched = await mapWithConcurrency(advisoryIds, VULN_DETAIL_CONCURRENCY, async (advisoryId) => {
    const url = `${baseUrl}/vulns/${encodeURIComponent(advisoryId)}`;
    const vuln = await fetchGetWithRetry<OsvVulnerability>(url, options.timeoutMs, options.http2Mode);
    return { advisoryId, vuln };
  });

  for (const { advisoryId, vuln } of fetched) {
    if (vuln) {
      details.set(advisoryId, vuln);
    }
  }

  return details;
}

async function fetchJsonWithRetry(
  url: string,
  body: unknown,
  timeoutMs: number,
  http2Mode: DepsHttp2Mode
): Promise<OsvBatchResponse> {
  let lastError: unknown;

  for (const delayMs of RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await sleep(delayMs);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await depsFetch(url, http2Mode, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Provider request failed: ${response.status}`);
      }

      return (await response.json()) as OsvBatchResponse;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error("Provider request failed");
}

export async function queryOsvForDependencies(
  dependencies: DependencyCoordinate[],
  options: { providerUrl: string; timeoutMs: number; http2Mode: DepsHttp2Mode }
): Promise<DepsFinding[]> {
  const findings: DepsFinding[] = [];

  for (let i = 0; i < dependencies.length; i += QUERY_BATCH_LIMIT) {
    const batch = dependencies.slice(i, i + QUERY_BATCH_LIMIT);
    const payload = {
      queries: batch.map((dep) => ({
        package: {
          name: dep.name,
          ecosystem: dep.ecosystem
        },
        version: dep.version
      }))
    };

    const response = await fetchJsonWithRetry(
      options.providerUrl,
      payload,
      options.timeoutMs,
      options.http2Mode
    );
    const results = response.results ?? [];

    const advisoryIdsNeedingDetails = new Set<string>();
    for (const result of results) {
      for (const vuln of result.vulns ?? []) {
        const advisoryId = vuln.id?.trim();
        if (advisoryId && vulnerabilityNeedsDetails(vuln)) {
          advisoryIdsNeedingDetails.add(advisoryId);
        }
      }
    }

    const detailsById =
      advisoryIdsNeedingDetails.size > 0
        ? await loadVulnerabilityDetails([...advisoryIdsNeedingDetails], options)
        : new Map<string, OsvVulnerability>();

    for (let index = 0; index < batch.length; index++) {
      const dep = batch[index];
      const vulns = results[index]?.vulns ?? [];
      for (const vuln of vulns) {
        const advisoryId = vuln.id?.trim();
        const enriched =
          advisoryId && detailsById.has(advisoryId)
            ? mergeVulnerability(vuln, detailsById.get(advisoryId) ?? null)
            : vuln;
        findings.push(normalizeVulnerability(dep, enriched));
      }
    }
  }

  return findings;
}

