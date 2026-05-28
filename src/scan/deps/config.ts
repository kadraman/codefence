import { parseDurationMs } from "../secret/config";
import {
  DEFAULT_DEPS_CACHE_TTL_MS,
  DEFAULT_DEPS_TIMEOUT_MS,
  DEFAULT_OSV_PROVIDER_URL,
  DepsHttp2Mode,
  DepsScope,
  DepsScanOptions
} from "./types";

function envTrim(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

function parseProvider(raw: string | undefined): DepsScanOptions["provider"] {
  const value = raw?.toLowerCase();
  if (!value || value === "osv") {
    return "osv";
  }
  if (value === "custom") {
    return "custom";
  }
  throw new Error(`Invalid dependency provider: ${raw}`);
}

function parseDepsScope(raw: string | undefined): DepsScope {
  const value = raw?.toLowerCase();
  if (!value || value === "changed") {
    return "changed";
  }
  if (value === "tree") {
    return "tree";
  }
  throw new Error(`Invalid deps scope: ${raw}`);
}

function parseHttp2Mode(raw: string | undefined): DepsHttp2Mode {
  const value = raw?.toLowerCase();
  if (!value || value === "auto") {
    return "auto";
  }
  if (value === "on" || value === "off") {
    return value;
  }
  throw new Error(`Invalid deps http2 mode: ${raw}`);
}

function parseBooleanSetting(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) {
    return defaultValue;
  }
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "on", "yes"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "off", "no"].includes(normalized)) {
    return false;
  }
  throw new Error(`Invalid boolean setting: ${value}`);
}

export function defaultDepsScanOptions(base: Partial<DepsScanOptions> = {}): DepsScanOptions {
  return {
    provider: parseProvider(envTrim("CODEFENCE_DEPS_PROVIDER") ?? base.provider),
    providerUrl: envTrim("CODEFENCE_DEPS_PROVIDER_URL") ?? base.providerUrl ?? null,
    refresh: parseBooleanSetting(envTrim("CODEFENCE_DEPS_REFRESH"), base.refresh ?? false),
    cacheTtlMs: parseDurationMs(envTrim("CODEFENCE_DEPS_CACHE_TTL"), base.cacheTtlMs ?? DEFAULT_DEPS_CACHE_TTL_MS),
    timeoutMs: parseDurationMs(envTrim("CODEFENCE_DEPS_TIMEOUT"), base.timeoutMs ?? DEFAULT_DEPS_TIMEOUT_MS),
    http2Mode: parseHttp2Mode(envTrim("CODEFENCE_DEPS_HTTP2") ?? base.http2Mode),
    scope: parseDepsScope(envTrim("CODEFENCE_DEPS_SCOPE") ?? base.scope)
  };
}

export function resolveDepsProviderUrl(options: DepsScanOptions): string {
  if (options.providerUrl) {
    return options.providerUrl;
  }
  if (options.provider === "osv") {
    return DEFAULT_OSV_PROVIDER_URL;
  }
  throw new Error("Custom dependency provider requires --deps-provider-url or CODEFENCE_DEPS_PROVIDER_URL");
}
