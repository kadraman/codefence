import { cliInvocation } from "../cliName";
import { formatGitScanIgnoredPrefixes } from "./ignorePaths";
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

export function parseScanArgv(argv: string[]): ParseScanResult {
  const { paths, rest: afterPaths } = collectPaths(argv);

  const onlyParsed = readFlagValue(afterPaths, "--only");
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
    skip
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
  --staged              Use staged git files instead of unstaged changes
  --paths <files...>    Scan explicit paths (default: git-changed files)
  --only <aspects>      Run only listed aspects (comma-separated; default: code)
  --skip <aspects>      Skip aspects (applied after --only)
  -h, --help            Show this help

Git-based scans skip: ${formatGitScanIgnoredPrefixes()}
  (explicit --paths still scans those files)

Aspects (default: code):
  code          Local secure-coding rules on changed source files

Environment:
  CODEFENCE_ASPECTS    Default aspect list (comma-separated; DSEC_ASPECTS accepted)
  CODEFENCE_ONLY       Same as --only (DSEC_ONLY accepted)
  CODEFENCE_SKIP       Same as --skip (DSEC_SKIP accepted)

Examples:
  ${cliInvocation("scan", "--staged")}
  ${cliInvocation("scan", "--paths src/app.ts")}
`);
}
