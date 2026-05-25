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

function pickRemediation(vuln: OsvVulnerability): string {
  for (const affected of vuln.affected ?? []) {
    for (const range of affected.ranges ?? []) {
      for (const event of range.events ?? []) {
        if (event.fixed?.trim()) {
          return `Upgrade to >= ${event.fixed.trim()}`;
        }
      }
    }
  }

  return "Upgrade to a patched version";
}

function normalizeVulnerability(
  dep: DependencyCoordinate,
  vuln: OsvVulnerability
): DepsFinding {
  const advisoryId = vuln.id?.trim() || "OSV-UNKNOWN";
  return {
    packageName: dep.name,
    version: dep.version,
    advisoryId,
    summary: vuln.summary?.trim() || vuln.details?.trim() || "Known vulnerability detected in dependency version",
    severity: pickSeverity(vuln),
    remediation: pickRemediation(vuln),
    manifestPath: dep.manifestPath
  };
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
    for (let index = 0; index < batch.length; index++) {
      const dep = batch[index];
      const vulns = results[index]?.vulns ?? [];
      for (const vuln of vulns) {
        findings.push(normalizeVulnerability(dep, vuln));
      }
    }
  }

  return findings;
}

