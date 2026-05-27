import { SecretScanOptions } from "./secret/types";
import { DepsScanOptions } from "./deps/types";

export const ASPECT_IDS = ["code", "deps"] as const;

export type AspectId = (typeof ASPECT_IDS)[number];

export const DEFAULT_ASPECTS: AspectId[] = ["code"];

export type AspectStatus = "ok" | "skipped" | "failed";

export type ScanOutputFormat = "table" | "json";

export interface ScanContext {
  cwd: string;
  files: string[];
  staged: boolean;
  /** True when the user passed explicit --paths (demo/test ignore lists are bypassed). */
  explicitPaths: boolean;
  /** Set when `--deps-scope tree`: all manifests discovered under the repo (or --paths roots). */
  depsManifestPaths: string[] | null;
  options: ScanOptions;
}

export interface ScanOptions {
  staged: boolean;
  paths: string[];
  only: AspectId[] | null;
  skip: AspectId[];
  secret: SecretScanOptions;
  deps: DepsScanOptions;
  outputFormat: ScanOutputFormat;
  /** Suppress progress and human-oriented messages (auto-enabled for --format json unless --verbose). */
  quiet: boolean;
  /** Emit progress to stderr even when --format json would otherwise be quiet. */
  verbose: boolean;
}

export type ScanOutputControl = Pick<ScanOptions, "outputFormat" | "quiet" | "verbose">;

export interface AspectOutcome {
  aspect: AspectId;
  status: AspectStatus;
  exitCode: number;
  message?: string;
}

export interface ScanAspect {
  id: AspectId;
  label: string;
  run(context: ScanContext): Promise<AspectOutcome> | AspectOutcome;
}
