import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { CLI_NAME } from "../cliName";
import { shouldScanFile } from "../scanner";
import { DebounceTracker } from "./debounce";
import { DEFAULT_DEBOUNCE_SECONDS, normalizeRelativePath } from "./paths";

const FILE_ENV_KEYS = [
  "KIRO_EDITED_FILE",
  "KIRO_FILE_PATH",
  "FILE_PATH",
  "EDITED_FILE",
  "CODEFENCE_EDITED_FILE",
  "DSEC_EDITED_FILE"
];

export interface BackgroundScanOptions {
  workspace?: string;
  filePath?: string;
  checkPendingOnly?: boolean;
  debounceSeconds?: number;
}

function logPanel(message: string): void {
  console.error(message);
}

function resolveCodefenceCli(): { command: string; args: string[] } {
  const entry = process.argv[1];
  if (entry && fs.existsSync(entry)) {
    return { command: process.execPath, args: [entry] };
  }
  return { command: CLI_NAME, args: [] };
}

export function launchScanWorker(workspace: string, target: string): void {
  const { command, args: baseArgs } = resolveCodefenceCli();
  const args = [
    ...baseArgs,
    "scan-worker",
    "--target",
    target,
    "--workspace",
    workspace
  ];

  const child = spawn(command, args, {
    cwd: workspace,
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  child.unref();
  logPanel(`[codefence] Queued code scan: ${target}`);
}

export function checkAndLaunchPendingScans(workspace: string, debounceSeconds: number): string[] {
  const tracker = new DebounceTracker(workspace, debounceSeconds);
  const launched: string[] = [];

  for (const filePath of tracker.getFilesReadyToScan()) {
    launchScanWorker(workspace, filePath);
    launched.push(filePath);
  }

  return launched;
}

function resolveFilePathFromStdin(): string | undefined {
  if (process.stdin.isTTY) {
    return undefined;
  }

  try {
    const raw = fs.readFileSync(0, "utf8").trim();
    if (!raw) {
      return undefined;
    }
    const data = JSON.parse(raw) as Record<string, unknown>;
    const candidates = [
      data.file_path,
      data.filePath,
      data.path,
      (data.file as Record<string, unknown> | undefined)?.path
    ];
    for (const value of candidates) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function resolveEditedFile(options: BackgroundScanOptions, workspace: string): string | undefined {
  if (options.filePath?.trim()) {
    return options.filePath.trim();
  }

  for (const key of FILE_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  const fromStdin = resolveFilePathFromStdin();
  if (fromStdin) {
    return fromStdin;
  }

  const arg = process.argv[2];
  if (arg && !arg.startsWith("--")) {
    return arg;
  }

  return undefined;
}

export function runBackgroundScan(options: BackgroundScanOptions = {}): number {
  const workspace = path.resolve(options.workspace ?? process.cwd());
  const parsedDebounce = Number.parseFloat(
    process.env.CODEFENCE_DEBOUNCE_SECONDS ?? process.env.DSEC_DEBOUNCE_SECONDS ?? ""
  );
  const debounceSeconds =
    options.debounceSeconds ??
    (Number.isFinite(parsedDebounce) ? parsedDebounce : DEFAULT_DEBOUNCE_SECONDS);

  const launched = checkAndLaunchPendingScans(workspace, debounceSeconds);

  if (options.checkPendingOnly) {
    if (launched.length > 0) {
      logPanel(`[codefence] Launched ${launched.length} debounced scan(s)`);
    }
    return 0;
  }

  const filePath = resolveEditedFile(options, workspace);
  if (!filePath) {
    if (launched.length === 0) {
      logPanel("[codefence] background-scan: no file path (pass --file or hook JSON on stdin)");
    }
    return 0;
  }

  const tracker = new DebounceTracker(workspace, debounceSeconds);
  const rel = normalizeRelativePath(workspace, filePath);
  const baseName = path.basename(rel);

  if (!shouldScanFile(rel)) {
    logPanel(`[codefence] Not scannable: ${baseName}`);
    return 0;
  }

  if (launched.includes(rel)) {
    logPanel(`[codefence] ${baseName} scanned via debounce queue`);
    return 0;
  }

  if (tracker.wasFilePending(filePath)) {
    tracker.addFile(filePath);
    logPanel(`[codefence] Debounced code scan: ${baseName}`);
    return 0;
  }

  launchScanWorker(workspace, rel);
  tracker.addFile(filePath);
  return 0;
}

export function parseBackgroundScanArgv(argv: string[]): BackgroundScanOptions {
  const options: BackgroundScanOptions = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--check-pending") {
      options.checkPendingOnly = true;
    } else if (arg === "--file" && argv[i + 1]) {
      options.filePath = argv[++i];
    } else if (arg === "--workspace" && argv[i + 1]) {
      options.workspace = argv[++i];
    }
  }

  return options;
}
