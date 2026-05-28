import { cliInvocation } from "../cliName";
import { hasDependencyFileChanges } from "../manifests";
import { formatGitScanIgnoredPrefixes } from "./ignorePaths";
import { defaultDepsScanOptions } from "./deps/config";
import { loadRepoScanDefaults } from "./repoConfig";
import {
  defaultSecretScanOptions,
  parseConfidenceLevel,
  parseDurationMs,
  parsePositiveNumber
} from "./secret/config";
import { SecretScanOptions } from "./secret/types";
import { ASPECT_IDS, AspectId, ScanOptions, ScanOutputFormat } from "./types";

const ASPECT_ALIASES: Record<string, AspectId> = {
  code: "code",
  deps: "deps"
};

export type ParseScanResult = ScanOptions | { help: true };

export function normalizeAspectId(value: string): AspectId | null {
  const key = value.trim().toLowerCase();
  return ASPECT_ALIASES[key] ?? null;
}

export function parseAspectList(raw: string): AspectId[] {
  const ids: AspectId[] = [];
  for (const part of raw.split(",")) {
    const id = normalizeAspectId(part);
    if (!id) {
      throw new Error(`Unknown scan aspect: ${part.trim()}`);
    }
    if (!ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}

function readFlagValue(argv: string[], flag: string): { value: string | null; rest: string[] } {
  const rest: string[] = [];
  let value: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === flag) {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("-")) {
        throw new Error(`${flag} requires a value`);
      }
      value = next;
      i++;
      continue;
    }
    if (arg.startsWith(`${flag}=`)) {
      const eqValue = arg.slice(flag.length + 1);
      if (!eqValue.trim()) {
        throw new Error(`${flag} requires a value`);
      }
      value = eqValue;
      continue;
    }
    rest.push(arg);
  }

  return { value, rest };
}

function collectPaths(argv: string[]): { paths: string[]; rest: string[] } {
  const paths: string[] = [];
  const rest: string[] = [];
  let i = 0;

  while (i < argv.length) {
    if (argv[i] === "--paths") {
      i++;
      while (i < argv.length && !argv[i].startsWith("--")) {
        paths.push(argv[i]);
        i++;
      }
      continue;
    }
    rest.push(argv[i]);
    i++;
  }

  return { paths, rest };
}

function collectFlagValues(argv: string[], flag: string): { values: string[]; rest: string[] } {
  const values: string[] = [];
  const rest: string[] = [];
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];
    if (arg === flag) {
      i++;
      if (i >= argv.length || argv[i].startsWith("--")) {
        throw new Error(`${flag} requires at least one value`);
      }
      while (i < argv.length && !argv[i].startsWith("--")) {
        values.push(argv[i]);
        i++;
      }
      continue;
    }
    if (arg.startsWith(`${flag}=`)) {
      const eqValue = arg.slice(flag.length + 1).trim();
      if (!eqValue) {
        throw new Error(`${flag} requires at least one value`);
      }
      values.push(eqValue);
      i++;
      continue;
    }
    rest.push(arg);
    i++;
  }

  return { values, rest };
}

function envTrim(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

function defaultAspectsFromEnv(fallback: AspectId[]): AspectId[] {
  const raw = envTrim("CODEFENCE_ASPECTS");
  if (!raw) {
    return [...fallback];
  }
  return parseAspectList(raw);
}

function parseOutputFormat(value: string | undefined): ScanOutputFormat {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized || normalized === "table") {
    return "table";
  }
  if (normalized === "json") {
    return "json";
  }
  throw new Error("--format must be table or json");
}

function parseBooleanEnv(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return ["1", "true", "on", "yes"].includes(normalized);
}

function parseOnOff(value: string, flag: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (normalized === "on") {
    return true;
  }
  if (normalized === "off") {
    return false;
  }
  throw new Error(`${flag} must be on or off`);
}

function parseSecretOptions(
  argv: string[],
  defaults: SecretScanOptions
): { secret: SecretScanOptions; rest: string[] } {
  const secretRules = collectFlagValues(argv, "--secret-rules");
  const defaultRules = readFlagValue(secretRules.rest, "--secret-default-rules");
  const defaultRulesVersion = readFlagValue(defaultRules.rest, "--secret-default-rules-version");
  const updateUrl = readFlagValue(defaultRulesVersion.rest, "--secret-rules-update-url");
  const cacheTtl = readFlagValue(updateUrl.rest, "--secret-rules-cache-ttl");
  const entropyThreshold = readFlagValue(cacheTtl.rest, "--secret-entropy-threshold");
  const minLength = readFlagValue(entropyThreshold.rest, "--secret-min-length");
  const minConfidence = readFlagValue(minLength.rest, "--secret-min-confidence");

  const secret: SecretScanOptions = {
    ...defaults,
    rulePaths: secretRules.values.length > 0 ? secretRules.values : defaults.rulePaths,
    defaultRules:
      defaultRules.value === null ? defaults.defaultRules : parseOnOff(defaultRules.value, "--secret-default-rules"),
    defaultRulesVersion:
      defaultRulesVersion.value === null ? defaults.defaultRulesVersion : defaultRulesVersion.value,
    rulesUpdateUrl: updateUrl.value === null ? defaults.rulesUpdateUrl : updateUrl.value,
    rulesRefresh: minConfidence.rest.includes("--secret-rules-refresh") || defaults.rulesRefresh,
    rulesCacheTtlMs:
      cacheTtl.value === null ? defaults.rulesCacheTtlMs : parseDurationMs(cacheTtl.value, defaults.rulesCacheTtlMs),
    entropyThreshold:
      entropyThreshold.value === null
        ? defaults.entropyThreshold
        : parsePositiveNumber(
            entropyThreshold.value,
            defaults.entropyThreshold,
            "Secret entropy threshold"
          ),
    minLength:
      minLength.value === null
        ? defaults.minLength
        : parsePositiveNumber(minLength.value, defaults.minLength, "Secret minimum length"),
    minConfidence:
      minConfidence.value === null
        ? defaults.minConfidence
        : parseConfidenceLevel(minConfidence.value, defaults.minConfidence)
  };

  return {
    secret,
    rest: minConfidence.rest.filter((arg) => arg !== "--secret-rules-refresh")
  };
}

export function parseScanArgv(argv: string[]): ParseScanResult {
  const configDefaults = loadRepoScanDefaults(process.cwd());
  const depsDefaults = defaultDepsScanOptions(configDefaults.deps);
  const secretDefaults = defaultSecretScanOptions(configDefaults.secret);
  const { paths, rest: afterPaths } = collectPaths(argv);
  const { deps, rest: afterDeps } = parseDepsOptions(afterPaths, depsDefaults);
  const { secret, rest: afterSecret } = parseSecretOptions(afterDeps, secretDefaults);

  const formatParsed = readFlagValue(afterSecret, "--format");
  const onlyParsed = readFlagValue(formatParsed.rest, "--only");
  const skipParsed = readFlagValue(onlyParsed.rest, "--skip");

  if (skipParsed.rest.some((a) => a === "--help" || a === "-h")) {
    return { help: true };
  }

  const onlyParsedValue = onlyParsed.value;
  const onlyEnv = envTrim("CODEFENCE_ONLY");
  let only: AspectId[] | null = null;

  if (onlyParsedValue !== null) {
    only = parseAspectList(onlyParsedValue);
  } else if (onlyEnv) {
    only = parseAspectList(onlyEnv);
  }

  let skip: AspectId[] = [];
  if (skipParsed.value !== null) {
    skip = parseAspectList(skipParsed.value);
  } else {
    const skipEnv = envTrim("CODEFENCE_SKIP");
    if (skipEnv) {
      skip = parseAspectList(skipEnv);
    }
  }

  const outputFormat: ScanOutputFormat = parseOutputFormat(
    formatParsed.value ?? envTrim("CODEFENCE_FORMAT") ?? configDefaults.format
  );

  const verbose =
    skipParsed.rest.includes("--verbose") || parseBooleanEnv(envTrim("CODEFENCE_VERBOSE")) || configDefaults.verbose;
  const quiet =
    skipParsed.rest.includes("--quiet") || parseBooleanEnv(envTrim("CODEFENCE_QUIET")) || configDefaults.quiet;

  const ignoredPrefixesEnv = envTrim("CODEFENCE_GIT_IGNORED_PREFIXES");
  const gitIgnoredPrefixes = ignoredPrefixesEnv
    ? ignoredPrefixesEnv.split(",").map((part) => part.trim()).filter(Boolean)
    : configDefaults.gitIgnoredPrefixes;

  return {
    staged: skipParsed.rest.includes("--staged"),
    paths,
    gitIgnoredPrefixes,
    defaultAspects: configDefaults.aspects,
    only,
    skip,
    secret,
    deps,
    outputFormat,
    quiet,
    verbose
  };
}

function sortAspects(aspects: AspectId[]): AspectId[] {
  return [...aspects].sort((left, right) => ASPECT_IDS.indexOf(left) - ASPECT_IDS.indexOf(right));
}

/** When dependency manifests are in scope, include deps unless the user narrowed aspects with --only. */
function shouldAutoIncludeDeps(options: ScanOptions, filesInScope: string[]): boolean {
  if (options.deps.scope === "tree") {
    return true;
  }
  return hasDependencyFileChanges(filesInScope);
}

function applyManifestTriggeredDeps(
  aspects: AspectId[],
  options: ScanOptions,
  filesInScope: string[]
): AspectId[] {
  if (options.skip.includes("deps")) {
    return aspects;
  }
  if (options.only && options.only.length > 0) {
    return aspects;
  }
  if (aspects.includes("deps")) {
    return aspects;
  }
  if (!shouldAutoIncludeDeps(options, filesInScope)) {
    return aspects;
  }
  return sortAspects([...aspects, "deps"]);
}

export function resolveAspects(options: ScanOptions, filesInScope: string[] = []): AspectId[] {
  let aspects: AspectId[];

  if (options.only && options.only.length > 0) {
    aspects = [...options.only];
  } else {
    aspects = defaultAspectsFromEnv(options.defaultAspects);
  }

  for (const skip of options.skip) {
    aspects = aspects.filter((id) => id !== skip);
  }

  return applyManifestTriggeredDeps(aspects, options, filesInScope);
}

export function printScanHelp(): void {
  console.log(`Usage: ${cliInvocation("scan", "[options]")}

Run local secure-coding guardrails on changed or explicit paths.

Options:
  --staged                           Use staged git files instead of unstaged changes
  --paths <files...>                 Scan explicit paths (default: git-changed files)
  --only <aspects>                   Run only listed aspects (comma-separated; default: code)
  --skip <aspects>                   Skip aspects (applied after --only)
  --format <table|json>              Findings as table (stdout) or NDJSON (stdout; progress on stderr)
  --quiet                            Suppress progress and human messages (default with --format json)
  --verbose                          Show progress on stderr even with --format json
  --deps-provider <osv|custom>       Dependency vulnerability provider (default: osv; custom not yet supported)
  --deps-provider-url <url>          Override dependency provider API endpoint
  --deps-refresh                     Force dependency provider refresh (ignore cache)
  --deps-cache-ttl <dur>             Dependency scan cache TTL (for example 24h)
  --deps-timeout <dur>               Dependency provider timeout (for example 15s)
  --deps-http2 <auto|on|off>         HTTP/2 for deps API: auto (Node default), on/off (undici)
  --deps-scope <changed|tree>        Deps file scope: changed (git/paths, default) or tree (all manifests)
  --secret-rules <path...>           Load Semgrep-style secret rules from YAML files or directories
  --secret-default-rules <on|off>    Enable bundled secret rules (default: on)
  --secret-default-rules-version <v> Select bundled secret rules version
  --secret-rules-update-url <url>    Download remote secret rule bundle
  --secret-rules-refresh             Force remote secret rule refresh
  --secret-rules-cache-ttl <dur>     Remote rule cache TTL (for example 24h)
  --secret-entropy-threshold <n>     Entropy threshold for generic secret detection
  --secret-min-length <n>            Minimum candidate length for entropy checks
  --secret-min-confidence <level>    Filter secret findings below low|medium|high confidence
  -h, --help                         Show this help

Git-based scans skip by default: ${formatGitScanIgnoredPrefixes()}
  (explicit --paths still scans those files)

Config file:
  codefence-config.yml              Repository defaults (CLI > env > config > built-in defaults)

Aspects (default: code; deps runs automatically when dependency manifests are in scope):
  code          Local secure-coding rules on changed source files
  deps          Dependency vulnerability scan for changed manifests

Environment:
  CODEFENCE_ASPECTS                 Default aspect list (comma-separated)
  CODEFENCE_ONLY                    Same as --only
  CODEFENCE_SKIP                    Same as --skip
  CODEFENCE_FORMAT                  Default output format (table or json)
  CODEFENCE_DEPS_PROVIDER           Same as --deps-provider
  CODEFENCE_DEPS_PROVIDER_URL       Same as --deps-provider-url
  CODEFENCE_DEPS_REFRESH            Same as --deps-refresh
  CODEFENCE_DEPS_CACHE_TTL          Same as --deps-cache-ttl
  CODEFENCE_DEPS_TIMEOUT            Same as --deps-timeout
  CODEFENCE_DEPS_HTTP2              Same as --deps-http2
  CODEFENCE_DEPS_SCOPE              Same as --deps-scope (changed or tree)
  CODEFENCE_GIT_IGNORED_PREFIXES    Comma-separated git-scan ignored prefixes (for example examples/,fixtures/)
  CODEFENCE_SECRET_RULES            Default Semgrep-style secret rule paths
  CODEFENCE_SECRET_DEFAULT_RULES    Same as --secret-default-rules
  CODEFENCE_SECRET_DEFAULT_RULES_VERSION  Same as --secret-default-rules-version
  CODEFENCE_SECRET_RULES_UPDATE_URL Same as --secret-rules-update-url
  CODEFENCE_SECRET_RULES_REFRESH    Same as --secret-rules-refresh
  CODEFENCE_SECRET_RULES_CACHE_TTL  Same as --secret-rules-cache-ttl
  CODEFENCE_SECRET_ENTROPY_THRESHOLD Same as --secret-entropy-threshold
  CODEFENCE_SECRET_MIN_LENGTH       Same as --secret-min-length
  CODEFENCE_SECRET_MIN_CONFIDENCE   Same as --secret-min-confidence

Examples:
  ${cliInvocation("scan", "--staged")}
  ${cliInvocation("scan", "--staged --only deps")}
  ${cliInvocation("scan", "--only deps --deps-scope tree")}
  ${cliInvocation("scan", "--paths src/app.ts --secret-rules .codefence/rules")}
  ${cliInvocation("scan", "--paths src config --secret-entropy-threshold 4.2 --secret-min-confidence medium")}
`);
}

function parseDepsProvider(value: string, flag: string): "osv" | "custom" {
  const normalized = value.trim().toLowerCase();
  if (normalized === "osv" || normalized === "custom") {
    return normalized;
  }
  throw new Error(`${flag} must be osv or custom`);
}

function parseDepsHttp2(value: string): "auto" | "on" | "off" {
  const normalized = value.trim().toLowerCase();
  if (normalized === "auto" || normalized === "on" || normalized === "off") {
    return normalized;
  }
  throw new Error("--deps-http2 must be auto, on, or off");
}

function parseDepsScopeFlag(value: string): "changed" | "tree" {
  const normalized = value.trim().toLowerCase();
  if (normalized === "changed" || normalized === "tree") {
    return normalized;
  }
  throw new Error("--deps-scope must be changed or tree");
}

function parseDepsOptions(
  argv: string[],
  defaults: ReturnType<typeof defaultDepsScanOptions>
): { deps: ReturnType<typeof defaultDepsScanOptions>; rest: string[] } {
  const provider = readFlagValue(argv, "--deps-provider");
  const providerUrl = readFlagValue(provider.rest, "--deps-provider-url");
  const cacheTtl = readFlagValue(providerUrl.rest, "--deps-cache-ttl");
  const timeout = readFlagValue(cacheTtl.rest, "--deps-timeout");
  const http2 = readFlagValue(timeout.rest, "--deps-http2");
  const scope = readFlagValue(http2.rest, "--deps-scope");
  const refresh = scope.rest.includes("--deps-refresh");

  return {
    deps: {
      ...defaults,
      provider: provider.value === null ? defaults.provider : parseDepsProvider(provider.value, "--deps-provider"),
      providerUrl: providerUrl.value === null ? defaults.providerUrl : providerUrl.value,
      refresh: refresh || defaults.refresh,
      cacheTtlMs: cacheTtl.value === null ? defaults.cacheTtlMs : parseDurationMs(cacheTtl.value, defaults.cacheTtlMs),
      timeoutMs: timeout.value === null ? defaults.timeoutMs : parseDurationMs(timeout.value, defaults.timeoutMs),
      http2Mode: http2.value === null ? defaults.http2Mode : parseDepsHttp2(http2.value),
      scope: scope.value === null ? defaults.scope : parseDepsScopeFlag(scope.value)
    },
    rest: scope.rest.filter((arg) => arg !== "--deps-refresh")
  };
}
