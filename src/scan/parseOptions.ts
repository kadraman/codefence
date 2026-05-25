import { cliInvocation } from "../cliName";
import { formatGitScanIgnoredPrefixes } from "./ignorePaths";
import {
  defaultSecretScanOptions,
  parseConfidenceLevel,
  parseDurationMs,
  parsePositiveNumber
} from "./secret/config";
import { SecretScanOptions } from "./secret/types";
import { AspectId, DEFAULT_ASPECTS, ScanOptions } from "./types";

const ASPECT_ALIASES: Record<string, AspectId> = {
  code: "code"
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

function envTrim(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

function defaultAspectsFromEnv(): AspectId[] {
  const raw = envTrim("CODEFENCE_ASPECTS", "DSEC_ASPECTS");
  if (!raw) {
    return [...DEFAULT_ASPECTS];
  }
  return parseAspectList(raw);
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

function parseSecretOptions(argv: string[]): { secret: SecretScanOptions; rest: string[] } {
  const defaults = defaultSecretScanOptions();
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
  const { paths, rest: afterPaths } = collectPaths(argv);
  const { secret, rest: afterSecret } = parseSecretOptions(afterPaths);

  const onlyParsed = readFlagValue(afterSecret, "--only");
  const skipParsed = readFlagValue(onlyParsed.rest, "--skip");

  if (skipParsed.rest.some((a) => a === "--help" || a === "-h")) {
    return { help: true };
  }

  const onlyParsedValue = onlyParsed.value;
  const onlyEnv = envTrim("CODEFENCE_ONLY", "DSEC_ONLY");
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
    const skipEnv = envTrim("CODEFENCE_SKIP", "DSEC_SKIP");
    if (skipEnv) {
      skip = parseAspectList(skipEnv);
    }
  }

  return {
    staged: skipParsed.rest.includes("--staged"),
    paths,
    only,
    skip,
    secret
  };
}

export function resolveAspects(options: ScanOptions): AspectId[] {
  let aspects: AspectId[];

  if (options.only && options.only.length > 0) {
    aspects = [...options.only];
  } else {
    aspects = defaultAspectsFromEnv();
  }

  for (const skip of options.skip) {
    aspects = aspects.filter((id) => id !== skip);
  }

  return aspects;
}

export function printScanHelp(): void {
  console.log(`Usage: ${cliInvocation("scan", "[options]")}

Run local secure-coding guardrails on changed or explicit paths.

Options:
  --staged                           Use staged git files instead of unstaged changes
  --paths <files...>                 Scan explicit paths (default: git-changed files)
  --only <aspects>                   Run only listed aspects (comma-separated; default: code)
  --skip <aspects>                   Skip aspects (applied after --only)
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

Git-based scans skip: ${formatGitScanIgnoredPrefixes()}
  (explicit --paths still scans those files)

Aspects (default: code):
  code          Local secure-coding rules on changed source files

Environment:
  CODEFENCE_ASPECTS                 Default aspect list (comma-separated; DSEC_ASPECTS accepted)
  CODEFENCE_ONLY                    Same as --only (DSEC_ONLY accepted)
  CODEFENCE_SKIP                    Same as --skip (DSEC_SKIP accepted)
  CODEFENCE_SECRET_RULES            Default Semgrep-style secret rule paths
  CODEFENCE_SECRET_DEFAULT_RULES    Same as --secret-default-rules
  CODEFENCE_SECRET_DEFAULT_RULES_VERSION  Same as --secret-default-rules-version
  CODEFENCE_SECRET_RULES_UPDATE_URL Same as --secret-rules-update-url
  CODEFENCE_SECRET_RULES_CACHE_TTL  Same as --secret-rules-cache-ttl
  CODEFENCE_SECRET_ENTROPY_THRESHOLD Same as --secret-entropy-threshold
  CODEFENCE_SECRET_MIN_LENGTH       Same as --secret-min-length
  CODEFENCE_SECRET_MIN_CONFIDENCE   Same as --secret-min-confidence

Examples:
  ${cliInvocation("scan", "--staged")}
  ${cliInvocation("scan", "--paths src/app.ts --secret-rules .codefence/rules")}
  ${cliInvocation("scan", "--paths src config --secret-entropy-threshold 4.2 --secret-min-confidence medium")}
`);
}
