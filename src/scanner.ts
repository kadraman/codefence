import fs from "node:fs";
import path from "node:path";
import { rules } from "./rules";
import { getMethodBlockLines } from "./rules/sast/methodBlock";
import { DEFAULT_SQL_INJECTION_WINDOW } from "./rules/sast/sqlInjection";
import { DEFAULT_HARDENING_LOOKAHEAD } from "./rules/sast/hardeningContext";
import { GIT_SCAN_IGNORED_PREFIXES } from "./scan/ignorePaths";
import { Finding, LineScanContext, Rule } from "./types";

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
  return rule.windowSize ?? DEFAULT_SQL_INJECTION_WINDOW;
}

function followingWindowSize(rule: Rule): number {
  return rule.windowSize ?? DEFAULT_HARDENING_LOOKAHEAD;
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
    methodBlockLines: getMethodBlockLines(lines, lineIndex)
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
const ignoredScanPrefixes: readonly string[] = GIT_SCAN_IGNORED_PREFIXES;

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
  ".rb"
]);

function normalizeRelativePath(filePath: string, cwd: string): string {
  const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
  return path.relative(cwd, absolute).replace(/\\/g, "/");
}

export function isIgnoredScanPath(filePath: string, cwd: string): boolean {
  const relative = normalizeRelativePath(filePath, cwd);
  return ignoredScanPrefixes.some((prefix) => relative.startsWith(prefix));
}

export function shouldScanFile(filePath: string, options?: { cwd?: string; allowIgnored?: boolean }): boolean {
  if (!supportedExtensions.has(path.extname(filePath).toLowerCase())) {
    return false;
  }

  if (options?.allowIgnored || !options?.cwd) {
    return true;
  }

  return !isIgnoredScanPath(filePath, options.cwd);
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

export function scanFile(filePath: string): Finding[] {
  if (!shouldScanFile(filePath) || !fs.existsSync(filePath)) {
    return [];
  }

  const findings: Finding[] = [];
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

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
          severity: rule.severity
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
          severity: rule.severity
        });
      }
    }
  });

  return findings;
}

export function scanFiles(filePaths: string[]): Finding[] {
  return filePaths.flatMap((filePath) => scanFile(filePath));
}
