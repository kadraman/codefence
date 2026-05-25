import { SecretScanOptions } from "./secret/types";
import { DepsScanOptions } from "./deps/types";

export const ASPECT_IDS = ["code", "deps"] as const;

export type AspectId = (typeof ASPECT_IDS)[number];

export const DEFAULT_ASPECTS: AspectId[] = ["code"];

export type AspectStatus = "ok" | "skipped" | "failed";

export interface ScanContext {
  cwd: string;
  files: string[];
  staged: boolean;
  /** True when the user passed explicit --paths (demo/test ignore lists are bypassed). */
  explicitPaths: boolean;
  options: ScanOptions;
}

export interface ScanOptions {
  staged: boolean;
  paths: string[];
  only: AspectId[] | null;
  skip: AspectId[];
  secret: SecretScanOptions;
  deps: DepsScanOptions;
}

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
