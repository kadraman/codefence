import path from "node:path";
import type { Finding } from "../types";
import type { ScanOutputFormat } from "./types";

type UnifiedCategory = "code" | "dependency";
type Severity = Finding["severity"];

const SEVERITY_RANK: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3
};

interface CodeTableRow {
  severity: string;
  filename: string;
  location: string;
  ruleId: string;
  message: string;
}

interface DepsTableRow {
  severity: string;
  package: string;
  version: string;
  fixed: string;
  cve: string;
  filename: string;
  location: string;
  message: string;
}

const CODE_TABLE_COLUMNS: (keyof CodeTableRow)[] = [
  "severity",
  "filename",
  "location",
  "ruleId",
  "message"
];

const DEPS_TABLE_COLUMNS: (keyof DepsTableRow)[] = [
  "severity",
  "package",
  "version",
  "fixed",
  "cve",
  "filename",
  "location",
  "message"
];

const CODE_TABLE_HEADERS: Record<keyof CodeTableRow, string> = {
  severity: "Severity",
  filename: "Filename",
  location: "Line",
  ruleId: "Rule",
  message: "Message"
};

const DEPS_TABLE_HEADERS: Record<keyof DepsTableRow, string> = {
  severity: "Severity",
  package: "Package",
  version: "Version",
  fixed: "Fixed",
  cve: "CVE",
  filename: "Filename",
  location: "Line",
  message: "Message"
};

function colorSeverity(value: string): string {
  const upper = value.toUpperCase();
  if (upper === "HIGH") {
    return `\u001b[31m${upper}\u001b[0m`;
  }
  if (upper === "MEDIUM") {
    return `\u001b[33m${upper}\u001b[0m`;
  }
  if (upper === "LOW") {
    return `\u001b[32m${upper}\u001b[0m`;
  }
  return upper;
}

function visibleLength(value: string): number {
  return value.replace(/\u001b\[[0-9;]*m/g, "").length;
}

function padVisible(value: string, width: number): string {
  const padding = Math.max(0, width - visibleLength(value));
  return value + " ".repeat(padding);
}

function compareSemver(a: string, b: string): number {
  const parse = (value: string): number[] =>
    value.split(/[.+_-]/).map((part) => Number.parseInt(part, 10)).map((part) => (Number.isNaN(part) ? 0 : part));

  const left = parse(a);
  const right = parse(b);
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index++) {
    const delta = (left[index] ?? 0) - (right[index] ?? 0);
    if (delta !== 0) {
      return delta;
    }
  }

  return 0;
}

function formatFixedVersion(finding: Finding): string {
  if (finding.fixedVersion) {
    return `>= ${finding.fixedVersion}`;
  }
  if (finding.remediation?.startsWith("Upgrade to >= ")) {
    return finding.remediation.slice("Upgrade to ".length);
  }
  return "-";
}

function relativeFilename(filePath: string, cwd: string): string {
  return path.relative(cwd, filePath).replace(/\\/g, "/");
}

function formatLocation(line: number): string {
  return line > 0 ? `${line}` : "-";
}

function aggregateDepsFindingsForTable(findings: Finding[]): Finding[] {
  const groups = new Map<string, Finding[]>();

  for (const finding of findings) {
    const key = [
      finding.packageName ?? "",
      finding.packageVersion ?? "",
      finding.filePath,
      finding.line
    ].join("|");
    const group = groups.get(key) ?? [];
    group.push(finding);
    groups.set(key, group);
  }

  const aggregated: Finding[] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort(
      (left, right) => SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity]
    );
    const primary = sorted[0];
    const fixedVersions = group
      .map((finding) => finding.fixedVersion)
      .filter((value): value is string => Boolean(value))
      .sort(compareSemver);
    const fixedVersion = fixedVersions.length > 0 ? fixedVersions[fixedVersions.length - 1] : undefined;
    const cveIds = [...new Set(sorted.map((finding) => finding.cveId).filter(Boolean))] as string[];
    const advisoryIds = [...new Set(sorted.map((finding) => finding.advisoryId).filter(Boolean))] as string[];
    const identifiers = cveIds.length > 0 ? cveIds : advisoryIds;
    const visibleIdentifiers = identifiers.slice(0, 2);
    const hiddenCount = identifiers.length - visibleIdentifiers.length;
    const cveLabel =
      visibleIdentifiers.length === 0
        ? "-"
        : hiddenCount > 0
          ? `${visibleIdentifiers.join(", ")} (+${hiddenCount})`
          : visibleIdentifiers.join(", ");

    aggregated.push({
      ...primary,
      fixedVersion,
      remediation: fixedVersion ? `Upgrade to >= ${fixedVersion}` : primary.remediation,
      cveId: cveLabel === "-" ? undefined : visibleIdentifiers[0],
      message:
        group.length > 1
          ? `${group.length} known vulnerabilities (${cveLabel})`
          : primary.message,
      evidence: cveLabel
    });
  }

  return aggregated.sort((left, right) => {
    const severityDelta = SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }
    const packageDelta = (left.packageName ?? "").localeCompare(right.packageName ?? "");
    if (packageDelta !== 0) {
      return packageDelta;
    }
    return left.line - right.line;
  });
}

function buildCodeTableRows(findings: Finding[], cwd: string): CodeTableRow[] {
  return findings.map((finding) => ({
    severity: finding.severity.toUpperCase(),
    filename: relativeFilename(finding.filePath, cwd),
    location: formatLocation(finding.line),
    ruleId: finding.ruleId,
    message: finding.message
  }));
}

function buildDepsTableRows(findings: Finding[], cwd: string): DepsTableRow[] {
  return aggregateDepsFindingsForTable(findings).map((finding) => ({
    severity: finding.severity.toUpperCase(),
    package: finding.packageName ?? "",
    version: finding.packageVersion ?? "",
    fixed: formatFixedVersion(finding),
    cve: finding.evidence ?? finding.cveId ?? "-",
    filename: relativeFilename(finding.filePath, cwd),
    location: formatLocation(finding.line),
    message: finding.message
  }));
}

function printTable<Row extends object>(
  rows: Row[],
  columns: (keyof Row)[],
  headers: Record<keyof Row, string>,
  headerPrefix: string
): void {
  if (rows.length === 0) {
    return;
  }

  const widths = Object.fromEntries(
    columns.map((key) => [key, headers[key].length])
  ) as Record<keyof Row, number>;

  for (const row of rows) {
    for (const key of columns) {
      const value = String(row[key] ?? "");
      if (value.length > widths[key]) {
        widths[key] = value.length;
      }
    }
  }

  const headerLine = columns.map((key) => headers[key].padEnd(widths[key])).join("  ");
  const underline = columns.map((key) => "-".repeat(widths[key])).join("  ");

  console.error(`${headerPrefix}${headerLine}`);
  console.error(`${headerPrefix}${underline}`);

  for (const row of rows) {
    const cells = columns.map((key) => {
      const value = String(row[key] ?? "");
      if (String(key) === "severity") {
        return padVisible(colorSeverity(value), widths[key]);
      }
      return value.padEnd(widths[key]);
    });
    console.error(`${headerPrefix}${cells.join("  ")}`);
  }
}

function printJson(findings: Finding[], category: UnifiedCategory, cwd: string): void {
  for (const finding of findings) {
    const filename = relativeFilename(finding.filePath, cwd);
    const payload = {
      severity: finding.severity,
      category,
      package: finding.packageName ?? null,
      version: finding.packageVersion ?? null,
      fixed: finding.fixedVersion ? `>= ${finding.fixedVersion}` : null,
      cve: finding.cveId ?? null,
      filename,
      location: finding.line > 0 ? { line: finding.line } : null,
      ruleId: finding.ruleId,
      advisoryId: finding.advisoryId ?? null,
      message: finding.message,
      confidence: finding.confidence ?? null,
      evidence: finding.evidence ?? null,
      remediation: finding.remediation ?? null,
      kind: finding.kind ?? null,
      detectionMethod: finding.detectionMethod ?? null
    };
    console.log(JSON.stringify(payload));
  }
}

export function printUnifiedFindings(
  aspectId: "code" | "deps",
  findings: Finding[],
  format: ScanOutputFormat,
  cwd: string
): void {
  if (findings.length === 0) {
    return;
  }

  const category: UnifiedCategory = aspectId === "code" ? "code" : "dependency";

  if (format === "json") {
    printJson(findings, category, cwd);
    return;
  }

  const headerPrefix = `[${aspectId}] `;
  if (aspectId === "deps") {
    printTable(buildDepsTableRows(findings, cwd), DEPS_TABLE_COLUMNS, DEPS_TABLE_HEADERS, headerPrefix);
    return;
  }

  printTable(buildCodeTableRows(findings, cwd), CODE_TABLE_COLUMNS, CODE_TABLE_HEADERS, headerPrefix);
}
