import type { Severity } from "./severity";

export type { Severity };

export interface Finding {
  ruleId: string;
  message: string;
  filePath: string;
  line: number;
  severity: Severity;
  confidence?: ConfidenceLevel;
  evidence?: string;
  remediation?: string;
  kind?: "code" | "secret" | "dependency";
  detectionMethod?: "rule" | "entropy" | "rule+entropy";
  packageName?: string;
  packageVersion?: string;
  advisoryId?: string;
  cveId?: string;
  fixedVersion?: string;
}

export type ConfidenceLevel = "low" | "medium" | "high";

export interface LineScanContext {
  priorLines: string[];
  followingLines: string[];
  methodBlockLines: string[];
}

export interface Rule {
  id: string;
  description: string;
  severity: Finding["severity"];
  test: (line: string) => boolean;
  message: string;
  /** When set, the scanner passes line context (sliding window + method block). */
  testWithWindow?: (line: string, context: LineScanContext) => boolean;
  windowSize?: number;
}
