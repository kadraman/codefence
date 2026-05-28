import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { AspectId, DEFAULT_ASPECTS } from "./types";
import { parseConfidenceLevel, parseDurationMs, parsePositiveNumber } from "./secret/config";
import { DEFAULT_DEPS_CACHE_TTL_MS, DEFAULT_DEPS_TIMEOUT_MS } from "./deps/types";
import {
  DEFAULT_SECRET_ENTROPY_THRESHOLD,
  DEFAULT_SECRET_MIN_LENGTH,
  DEFAULT_SECRET_RULES_CACHE_TTL_MS
} from "./secret/types";
import { DEFAULT_GIT_SCAN_IGNORED_PREFIXES } from "./ignorePaths";
import { SecretScanOptions } from "./secret/types";
import { DepsScanOptions } from "./deps/types";

const ASPECT_ALIASES: Record<string, AspectId> = {
  code: "code",
  deps: "deps"
};

interface RepoConfigYaml {
  version?: unknown;
  scan?: {
    aspects?: unknown;
    format?: unknown;
    quiet?: unknown;
    verbose?: unknown;
  };
  paths?: {
    git_ignored_prefixes?: unknown;
  };
  deps?: Record<string, unknown>;
  secret?: Record<string, unknown>;
}

export interface RepoScanDefaults {
  aspects: AspectId[];
  format: "table" | "json";
  quiet: boolean;
  verbose: boolean;
  gitIgnoredPrefixes: string[];
  deps: DepsScanOptions;
  secret: SecretScanOptions;
}

function parseAspectList(raw: string): AspectId[] {
  const ids: AspectId[] = [];
  for (const part of raw.split(",")) {
    const key = part.trim().toLowerCase();
    const id = ASPECT_ALIASES[key];
    if (!id) {
      throw new Error(`Unknown scan aspect in codefence-config.yml: ${part.trim()}`);
    }
    if (!ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}

function parseBoolean(value: unknown, field: string, defaultValue: boolean): boolean {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "on", "yes"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "off", "no"].includes(normalized)) {
      return false;
    }
  }
  throw new Error(`Invalid boolean in codefence-config.yml: ${field}`);
}

function parseString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`Invalid string in codefence-config.yml: ${field}`);
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseStringList(value: unknown, field: string): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`Invalid list in codefence-config.yml: ${field}`);
  }
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) {
      throw new Error(`Invalid list entry in codefence-config.yml: ${field}`);
    }
    out.push(item.trim());
  }
  return out;
}

function parseOutputFormat(raw: unknown, defaultValue: "table" | "json"): "table" | "json" {
  if (raw === undefined || raw === null) {
    return defaultValue;
  }
  if (typeof raw !== "string") {
    throw new Error("Invalid scan.format in codefence-config.yml");
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "table" || normalized === "json") {
    return normalized;
  }
  throw new Error("scan.format in codefence-config.yml must be table or json");
}

function parseDepsScope(raw: unknown, defaultValue: "changed" | "tree"): "changed" | "tree" {
  if (raw === undefined || raw === null) {
    return defaultValue;
  }
  if (typeof raw !== "string") {
    throw new Error("Invalid deps.scope in codefence-config.yml");
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "changed" || normalized === "tree") {
    return normalized;
  }
  throw new Error("deps.scope in codefence-config.yml must be changed or tree");
}

function parseDepsHttp2(raw: unknown, defaultValue: "auto" | "on" | "off"): "auto" | "on" | "off" {
  if (raw === undefined || raw === null) {
    return defaultValue;
  }
  if (typeof raw !== "string") {
    throw new Error("Invalid deps.http2 in codefence-config.yml");
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "auto" || normalized === "on" || normalized === "off") {
    return normalized;
  }
  throw new Error("deps.http2 in codefence-config.yml must be auto, on, or off");
}

function parseDepsProvider(raw: unknown, defaultValue: "osv" | "custom"): "osv" | "custom" {
  if (raw === undefined || raw === null) {
    return defaultValue;
  }
  if (typeof raw !== "string") {
    throw new Error("Invalid deps.provider in codefence-config.yml");
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "osv" || normalized === "custom") {
    return normalized;
  }
  throw new Error("deps.provider in codefence-config.yml must be osv or custom");
}

function parseOnOff(raw: unknown, field: string, defaultValue: boolean): boolean {
  if (raw === undefined || raw === null) {
    return defaultValue;
  }
  if (typeof raw === "boolean") {
    return raw;
  }
  if (typeof raw !== "string") {
    throw new Error(`Invalid ${field} in codefence-config.yml`);
  }
  const normalized = raw.trim().toLowerCase();
  if (["on", "true", "yes", "1"].includes(normalized)) {
    return true;
  }
  if (["off", "false", "no", "0"].includes(normalized)) {
    return false;
  }
  throw new Error(`${field} in codefence-config.yml must be on/off or true/false`);
}

export function configFilePath(cwd: string = process.cwd()): string {
  return path.join(cwd, "codefence-config.yml");
}

export function loadRepoScanDefaults(cwd: string = process.cwd()): RepoScanDefaults {
  const depsDefaults: DepsScanOptions = {
    provider: "osv",
    providerUrl: null,
    refresh: false,
    cacheTtlMs: DEFAULT_DEPS_CACHE_TTL_MS,
    timeoutMs: DEFAULT_DEPS_TIMEOUT_MS,
    http2Mode: "auto",
    scope: "changed"
  };
  const secretDefaults: SecretScanOptions = {
    rulePaths: [],
    defaultRules: true,
    defaultRulesVersion: null,
    rulesUpdateUrl: null,
    rulesRefresh: false,
    rulesCacheTtlMs: DEFAULT_SECRET_RULES_CACHE_TTL_MS,
    entropyThreshold: DEFAULT_SECRET_ENTROPY_THRESHOLD,
    minLength: DEFAULT_SECRET_MIN_LENGTH,
    minConfidence: "low"
  };
  const defaults: RepoScanDefaults = {
    aspects: [...DEFAULT_ASPECTS],
    format: "table",
    quiet: false,
    verbose: false,
    gitIgnoredPrefixes: [...DEFAULT_GIT_SCAN_IGNORED_PREFIXES],
    deps: depsDefaults,
    secret: secretDefaults
  };

  const filePath = configFilePath(cwd);
  if (!fs.existsSync(filePath)) {
    return defaults;
  }

  const source = fs.readFileSync(filePath, "utf8");
  const parsed = (parseYaml(source) ?? {}) as RepoConfigYaml;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("codefence-config.yml must contain an object");
  }
  if (parsed.version !== undefined && parsed.version !== 1) {
    throw new Error("codefence-config.yml version must be 1");
  }

  const scan = parsed.scan ?? {};
  const scanAspects = scan.aspects;
  const aspects =
    scanAspects === undefined
      ? defaults.aspects
      : Array.isArray(scanAspects)
        ? parseAspectList(scanAspects.join(","))
        : typeof scanAspects === "string"
          ? parseAspectList(scanAspects)
          : (() => {
              throw new Error("scan.aspects in codefence-config.yml must be a list or comma-separated string");
            })();

  const prefixes = parseStringList(parsed.paths?.git_ignored_prefixes, "paths.git_ignored_prefixes");

  const depsSource = parsed.deps ?? {};
  const secretSource = parsed.secret ?? {};

  return {
    aspects,
    format: parseOutputFormat(scan.format, defaults.format),
    quiet: parseBoolean(scan.quiet, "scan.quiet", defaults.quiet),
    verbose: parseBoolean(scan.verbose, "scan.verbose", defaults.verbose),
    gitIgnoredPrefixes: prefixes.length > 0 ? prefixes : defaults.gitIgnoredPrefixes,
    deps: {
      ...depsDefaults,
      provider: parseDepsProvider(depsSource.provider, depsDefaults.provider),
      providerUrl: parseString(depsSource.provider_url, "deps.provider_url"),
      refresh: parseBoolean(depsSource.refresh, "deps.refresh", depsDefaults.refresh),
      cacheTtlMs: parseDurationMs(
        parseString(depsSource.cache_ttl, "deps.cache_ttl") ?? undefined,
        depsDefaults.cacheTtlMs
      ),
      timeoutMs: parseDurationMs(
        parseString(depsSource.timeout, "deps.timeout") ?? undefined,
        depsDefaults.timeoutMs
      ),
      http2Mode: parseDepsHttp2(depsSource.http2, depsDefaults.http2Mode),
      scope: parseDepsScope(depsSource.scope, depsDefaults.scope)
    },
    secret: {
      ...secretDefaults,
      rulePaths: parseStringList(secretSource.rules, "secret.rules"),
      defaultRules: parseOnOff(secretSource.default_rules, "secret.default_rules", secretDefaults.defaultRules),
      defaultRulesVersion:
        parseString(secretSource.default_rules_version, "secret.default_rules_version") ??
        secretDefaults.defaultRulesVersion,
      rulesUpdateUrl: parseString(secretSource.rules_update_url, "secret.rules_update_url"),
      rulesRefresh: parseBoolean(secretSource.rules_refresh, "secret.rules_refresh", secretDefaults.rulesRefresh),
      rulesCacheTtlMs: parseDurationMs(
        parseString(secretSource.rules_cache_ttl, "secret.rules_cache_ttl") ?? undefined,
        secretDefaults.rulesCacheTtlMs
      ),
      entropyThreshold: parsePositiveNumber(
        parseString(secretSource.entropy_threshold, "secret.entropy_threshold") ?? undefined,
        secretDefaults.entropyThreshold,
        "Secret entropy threshold"
      ),
      minLength: parsePositiveNumber(
        parseString(secretSource.min_length, "secret.min_length") ?? undefined,
        secretDefaults.minLength,
        "Secret minimum length"
      ),
      minConfidence: parseConfidenceLevel(
        parseString(secretSource.min_confidence, "secret.min_confidence") ?? undefined,
        secretDefaults.minConfidence
      )
    }
  };
}
