import { DepsFinding, DependencyCoordinate } from "./types";

const QUERY_BATCH_LIMIT = 100;
const RETRY_DELAYS_MS = [0, 300];

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

function severityFromScore(score: string | undefined): DepsFinding["severity"] | null {
  if (!score) {
    return null;
  }

  const normalized = score.toLowerCase();
  if (normalized.includes("critical") || normalized.includes("high")) {
    return "high";
  }
  if (normalized.includes("medium")) {
    return "medium";
  }
  if (normalized.includes("low")) {
    return "low";
  }

  const numeric = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!numeric) {
    return null;
  }
  const value = Number.parseFloat(numeric[1]);
  if (value >= 7) {
    return "high";
  }
  if (value >= 4) {
    return "medium";
  }
  return "low";
}

function pickSeverity(vuln: OsvVulnerability): DepsFinding["severity"] {
  for (const affected of vuln.affected ?? []) {
    const sev = severityFromScore(
      affected.database_specific?.severity ?? affected.ecosystem_specific?.severity
    );
    if (sev) {
      return sev;
    }
  }

  for (const score of vuln.severity ?? []) {
    const sev = severityFromScore(score.score);
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

async function fetchGetWithRetry<T>(url: string, timeoutMs: number): Promise<T | null> {
  let lastError: unknown;

  for (const delayMs of RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await sleep(delayMs);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
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

async function loadVulnerabilityDetails(
  advisoryIds: string[],
  options: { providerUrl: string; timeoutMs: number }
): Promise<Map<string, OsvVulnerability>> {
  const baseUrl = providerBaseUrl(options.providerUrl);
  const details = new Map<string, OsvVulnerability>();

  await Promise.all(
    advisoryIds.map(async (advisoryId) => {
      const url = `${baseUrl}/vulns/${encodeURIComponent(advisoryId)}`;
      const vuln = await fetchGetWithRetry<OsvVulnerability>(url, options.timeoutMs);
      if (vuln) {
        details.set(advisoryId, vuln);
      }
    })
  );

  return details;
}

async function fetchJsonWithRetry(url: string, body: unknown, timeoutMs: number): Promise<OsvBatchResponse> {
  let lastError: unknown;

  for (const delayMs of RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await sleep(delayMs);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
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
  options: { providerUrl: string; timeoutMs: number }
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

    const response = await fetchJsonWithRetry(options.providerUrl, payload, options.timeoutMs);
    const results = response.results ?? [];

    const advisoryIds = new Set<string>();
    for (const result of results) {
      for (const vuln of result.vulns ?? []) {
        const advisoryId = vuln.id?.trim();
        if (advisoryId) {
          advisoryIds.add(advisoryId);
        }
      }
    }

    const detailsById = advisoryIds.size > 0
      ? await loadVulnerabilityDetails([...advisoryIds], options)
      : new Map<string, OsvVulnerability>();

    for (let index = 0; index < batch.length; index++) {
      const dep = batch[index];
      const vulns = results[index]?.vulns ?? [];
      for (const vuln of vulns) {
        const advisoryId = vuln.id?.trim();
        const enriched = advisoryId ? mergeVulnerability(vuln, detailsById.get(advisoryId) ?? null) : vuln;
        findings.push(normalizeVulnerability(dep, enriched));
      }
    }
  }

  return findings;
}

