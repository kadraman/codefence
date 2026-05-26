import { Finding } from "../../types";

export const DEFAULT_DEPS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_DEPS_TIMEOUT_MS = 15 * 1000;
export const DEFAULT_OSV_PROVIDER_URL = "https://api.osv.dev/v1/querybatch";
export const DEPS_FINDING_RULE_ID = "vulnerable-dependency";

export type DepsProvider = "osv" | "custom";
export type DepsHttp2Mode = "auto" | "on" | "off";

export interface DepsScanOptions {
  provider: DepsProvider;
  providerUrl: string | null;
  refresh: boolean;
  cacheTtlMs: number;
  timeoutMs: number;
  http2Mode: DepsHttp2Mode;
}

export interface DependencyCoordinate {
  ecosystem: string;
  name: string;
  version: string;
  manifestPath: string;
  manifestLine: number;
}

export interface DepsFinding {
  packageName: string;
  version: string;
  advisoryId: string;
  cveId: string | null;
  summary: string;
  severity: Finding["severity"];
  remediation: string;
  fixedVersion: string | null;
  manifestPath: string;
  manifestLine: number;
}

