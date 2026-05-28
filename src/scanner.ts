import fs from "node:fs";
import path from "node:path";
import { rules } from "./rules";
import { DEFAULT_GIT_SCAN_IGNORED_PREFIXES } from "./scan/ignorePaths";
import { defaultSecretScanOptions } from "./scan/secret/config";
import { scanSecretFindings } from "./scan/secret/engine";
import { loadSecretRulesForScan } from "./scan/secret/rulesCache";
import { SecretRule, SecretScanOptions } from "./scan/secret/types";
import { Finding, LineScanContext, Rule } from "./types";

const DEFAULT_PRIOR_WINDOW = 15;
const DEFAULT_FOLLOWING_WINDOW = 40;

/** Shared slices for a line index; rule-specific views avoid re-scanning method blocks. */
interface LineContextCache {
  priorMax: string[];
  followingMax: string[];
  methodBlockLines: string[];
}

function ruleMatchesLine(rule: Rule, line: string, context: LineScanContext): boolean {
  if (rule.testWithWindow) {
    return rule.testWithWindow(line, context);
  }

  return rule.test(line);
}

function priorWindowSize(rule: Rule): number {
  return rule.windowSize ?? DEFAULT_PRIOR_WINDOW;
}

function followingWindowSize(rule: Rule): number {
  return rule.windowSize ?? DEFAULT_FOLLOWING_WINDOW;
}

function maxWindowSizes(windowedRules: Rule[]): { maxPrior: number; maxLookahead: number } {
  let maxPrior = 0;
  let maxLookahead = 0;

  for (const rule of windowedRules) {
    maxPrior = Math.max(maxPrior, priorWindowSize(rule));
    maxLookahead = Math.max(maxLookahead, followingWindowSize(rule));
  }

  return { maxPrior, maxLookahead };
}

function buildLineContextCache(
  lines: string[],
  lineIndex: number,
  maxPrior: number,
  maxLookahead: number
): LineContextCache {
  const priorStart = Math.max(0, lineIndex - maxPrior);

  return {
    priorMax: lines.slice(priorStart, lineIndex),
    followingMax: lines.slice(lineIndex + 1, lineIndex + 1 + maxLookahead),
    methodBlockLines: []
  };
}

/** Narrow a cached context to the prior/following sizes a rule expects. */
export function lineContextForRule(cache: LineContextCache, rule: Rule): LineScanContext {
  const priorCount = priorWindowSize(rule);
  const followingCount = followingWindowSize(rule);
  const priorStart = Math.max(0, cache.priorMax.length - priorCount);

  return {
    priorLines: cache.priorMax.slice(priorStart),
    followingLines: cache.followingMax.slice(0, followingCount),
    methodBlockLines: cache.methodBlockLines
  };
}

/** Paths skipped during git-based scans; still scanned when passed via --paths. */
const ignoredScanPrefixes: readonly string[] = DEFAULT_GIT_SCAN_IGNORED_PREFIXES;

const supportedExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".java",
  ".cs",
  ".go",
  ".rb",
  ".json",
  ".yaml",
  ".yml",
  ".env",
  ".ini",
  ".conf"
]);

function normalizeRelativePath(filePath: string, cwd: string): string {
  const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
  return path.relative(cwd, absolute).replace(/\\/g, "/");
}

export function isIgnoredScanPath(
  filePath: string,
  cwd: string,
  prefixes: readonly string[] = ignoredScanPrefixes
): boolean {
  const relative = normalizeRelativePath(filePath, cwd);
  return prefixes.some((prefix) => relative.startsWith(prefix));
}

export function shouldScanFile(
  filePath: string,
  options?: { cwd?: string; allowIgnored?: boolean; ignoredPrefixes?: readonly string[] }
): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const baseName = path.basename(filePath).toLowerCase();
  const hasSupportedType = supportedExtensions.has(ext) || baseName === ".env";
  if (!hasSupportedType) {
    return false;
  }

  if (options?.allowIgnored) {
    return true;
  }

  const cwd = options?.cwd ?? process.cwd();
  return !isIgnoredScanPath(filePath, cwd, options?.ignoredPrefixes);
}

function walkScannableFiles(dir: string, cwd: string, out: Set<string>): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkScannableFiles(fullPath, cwd, out);
    } else if (entry.isFile() && shouldScanFile(fullPath, { cwd, allowIgnored: true })) {
      out.add(fullPath);
    }
  }
}

/** Expand explicit scan paths: files are kept; directories are walked recursively. */
export function expandScanPaths(paths: string[], cwd: string): string[] {
  const resolved = new Set<string>();

  for (const raw of paths) {
    const absolute = path.isAbsolute(raw) ? raw : path.resolve(cwd, raw);
    if (!fs.existsSync(absolute)) {
      continue;
    }

    const stat = fs.statSync(absolute);
    if (stat.isFile()) {
      if (shouldScanFile(absolute, { cwd, allowIgnored: true })) {
        resolved.add(absolute);
      }
      continue;
    }

    if (stat.isDirectory()) {
      walkScannableFiles(absolute, cwd, resolved);
    }
  }

  return [...resolved].sort();
}

function scanLegacyRules(filePath: string, lines: string[]): Finding[] {
  const findings: Finding[] = [];
  const windowedRules: Rule[] = [];
  const plainRules: Rule[] = [];

  for (const rule of rules) {
    if (rule.testWithWindow) {
      windowedRules.push(rule);
    } else {
      plainRules.push(rule);
    }
  }

  const { maxPrior, maxLookahead } = maxWindowSizes(windowedRules);

  lines.forEach((line, index) => {
    const lineCache =
      windowedRules.length > 0 ? buildLineContextCache(lines, index, maxPrior, maxLookahead) : null;

    for (const rule of plainRules) {
      if (rule.test(line)) {
        findings.push({
          ruleId: rule.id,
          message: rule.message,
          filePath,
          line: index + 1,
          severity: rule.severity,
          kind: "code"
        });
      }
    }

    if (!lineCache) {
      return;
    }

    for (const rule of windowedRules) {
      if (ruleMatchesLine(rule, line, lineContextForRule(lineCache, rule))) {
        findings.push({
          ruleId: rule.id,
          message: rule.message,
          filePath,
          line: index + 1,
          severity: rule.severity,
          kind: "code"
        });
      }
    }
  });

  return findings;
}

export interface ScanFileOptions {
  workspace?: string;
  secret?: SecretScanOptions;
  /** Pre-loaded secret rules; when omitted, loaded once per scanFiles batch (or per scanFile). */
  secretRules?: SecretRule[];
}

export async function scanFile(filePath: string, options: ScanFileOptions = {}): Promise<Finding[]> {
  const workspace = path.resolve(options.workspace ?? process.cwd());
  if (!shouldScanFile(filePath, { cwd: workspace, allowIgnored: true }) || !fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const secretOptions = options.secret ?? defaultSecretScanOptions();
  const secretRules =
    options.secretRules ?? (await loadSecretRulesForScan(workspace, secretOptions));

  const secretFindings = await scanSecretFindings({
    filePath,
    content,
    workspace,
    options: secretOptions,
    rules: secretRules
  });
  return [...scanLegacyRules(filePath, lines), ...secretFindings];
}

export async function scanFiles(filePaths: string[], options: ScanFileOptions = {}): Promise<Finding[]> {
  const workspace = path.resolve(options.workspace ?? process.cwd());
  const secretOptions = options.secret ?? defaultSecretScanOptions();
  const secretRules =
    options.secretRules ?? (await loadSecretRulesForScan(workspace, secretOptions));
  const batchOptions: ScanFileOptions = {
    ...options,
    workspace,
    secret: secretOptions,
    secretRules
  };

  const findings = await Promise.all(filePaths.map((filePath) => scanFile(filePath, batchOptions)));
  return findings.flat();
}
