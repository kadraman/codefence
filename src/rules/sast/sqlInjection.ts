import { LineScanContext, Rule } from "../../types";

/** Prior lines searched for dynamic SQL built via string concatenation. */
export const DEFAULT_SQL_INJECTION_WINDOW = 15;

/** String literal concatenated with another expression (line-level heuristic). */
export const dynamicSqlConcat = /["'][^"']*["']\s*\+|\+\s*["'][^"']*["']/;

export interface SqlInjectionRuleConfig {
  id: string;
  description: string;
  message: string;
  /** Matches the vulnerable API call on the current line (must end at opening paren). */
  methodCallPattern: RegExp;
  /** When set, the call line must also match (disambiguates Session vs EntityManager). */
  receiverPattern?: RegExp;
  windowSize?: number;
}

/** First argument to the call when it is a simple identifier (not an inline expression). */
export function extractFirstArgIdentifier(line: string, methodCallPattern: RegExp): string | null {
  const match = methodCallPattern.exec(line);
  if (!match) {
    return null;
  }

  const afterOpenParen = line.slice(match.index + match[0].length);
  const argMatch = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*[,)]/.exec(afterOpenParen);
  return argMatch?.[1] ?? null;
}

/** True when the sliding window contains an assignment to {@code varName} built with concatenation. */
export function hasDynamicSqlAssignment(varName: string, priorLines: string[]): boolean {
  if (priorLines.length === 0) {
    return false;
  }

  const windowText = priorLines.join("\n");
  const assignmentPattern = new RegExp(
    `\\b(?:final\\s+)?(?:String\\s+)?${varName}\\b\\s*=[\\s\\S]*?(?:["'][^"']*["']\\s*\\+|\\+\\s*["'])`
  );

  return assignmentPattern.test(windowText);
}

export function matchesSqlInjection(
  line: string,
  context: LineScanContext,
  config: SqlInjectionRuleConfig
): boolean {
  const priorLines = context.priorLines;
  if (!config.methodCallPattern.test(line)) {
    return false;
  }

  if (config.receiverPattern && !config.receiverPattern.test(line)) {
    return false;
  }

  if (dynamicSqlConcat.test(line)) {
    return true;
  }

  const variable = extractFirstArgIdentifier(line, config.methodCallPattern);
  return variable !== null && hasDynamicSqlAssignment(variable, priorLines);
}

export function createSqlInjectionRule(config: SqlInjectionRuleConfig): Rule {
  const windowSize = config.windowSize ?? DEFAULT_SQL_INJECTION_WINDOW;

  const emptyContext: LineScanContext = { priorLines: [], followingLines: [], methodBlockLines: [] };

  const testWithWindow = (line: string, context: LineScanContext): boolean =>
    matchesSqlInjection(line, context, config);

  return {
    id: config.id,
    description: config.description,
    severity: "high",
    message: config.message,
    windowSize,
    test: (line: string) => testWithWindow(line, { ...emptyContext, methodBlockLines: [line] }),
    testWithWindow
  };
}
