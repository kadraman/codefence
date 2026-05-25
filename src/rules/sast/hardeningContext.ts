import { LineScanContext, Rule } from "../../types";

export const DEFAULT_HARDENING_LOOKAHEAD = 40;

export interface HardeningRuleConfig {
  id: string;
  description: string;
  message: string;
  severity: Rule["severity"];
  /** Lines that may require hardening (e.g. factory newInstance, new Cookie). */
  triggerPattern: RegExp;
  /** Always flagged when matched (e.g. setHttpOnly(false)). */
  alwaysFlagPattern?: RegExp;
  /** Build hardening patterns for the method block (receiver-scoped when available). */
  hardeningChecks: (receiver: string | null) => RegExp[];
  extractReceiver?: (line: string) => string | null;
  windowSize?: number;
}

export function extractCookieReceiver(line: string): string | null {
  const match =
    /\b(?:jakarta\.servlet\.http\.)?Cookie\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*new\b/.exec(line) ??
    /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*new\s+(?:jakarta\.servlet\.http\.)?Cookie\s*\(/.exec(line);
  return match?.[1] ?? null;
}

export function extractFactoryReceiver(line: string, factoryName: string): string | null {
  const typed = new RegExp(
    `\\b${factoryName}\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\s*=\\s*[^;]*\\b${factoryName}\\s*\\.\\s*newInstance\\s*\\(`
  ).exec(line);
  if (typed?.[1]) {
    return typed[1];
  }

  const assigned = new RegExp(
    `\\b([a-zA-Z_][a-zA-Z0-9_]*)\\s*=\\s*[^;]*\\b${factoryName}\\s*\\.\\s*newInstance\\s*\\(`
  ).exec(line);
  return assigned?.[1] ?? null;
}

export function hasHardeningInBlock(methodBlockLines: string[], checks: RegExp[]): boolean {
  const blockText = methodBlockLines.join("\n");
  return checks.some((pattern) => pattern.test(blockText));
}

export function matchesHardeningRule(line: string, context: LineScanContext, config: HardeningRuleConfig): boolean {
  if (config.alwaysFlagPattern?.test(line)) {
    return true;
  }

  if (!config.triggerPattern.test(line)) {
    return false;
  }

  const receiver = config.extractReceiver?.(line) ?? null;
  const checks = config.hardeningChecks(receiver);
  return !hasHardeningInBlock(context.methodBlockLines, checks);
}

export function createHardeningRule(config: HardeningRuleConfig): Rule {
  const windowSize = config.windowSize ?? DEFAULT_HARDENING_LOOKAHEAD;

  const testWithWindow = (line: string, context: LineScanContext): boolean =>
    matchesHardeningRule(line, context, config);

  return {
    id: config.id,
    description: config.description,
    severity: config.severity,
    message: config.message,
    windowSize,
    test: (line: string) => testWithWindow(line, { priorLines: [], followingLines: [], methodBlockLines: [line] }),
    testWithWindow
  };
}
