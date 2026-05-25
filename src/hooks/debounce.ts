import fs from "node:fs";
import path from "node:path";
import { DEFAULT_DEBOUNCE_SECONDS, debounceStatePath, ensureDir, normalizeRelativePath } from "./paths";

export interface DebounceState {
  pendingFiles: Record<string, string>;
  lastUpdate: string | null;
}

function emptyState(): DebounceState {
  return {
    pendingFiles: {},
    lastUpdate: null
  };
}

function isValidTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export class DebounceTracker {
  constructor(
    private readonly workspace: string,
    private readonly debounceSeconds = DEFAULT_DEBOUNCE_SECONDS
  ) {}

  private stateFile(): string {
    return debounceStatePath(this.workspace);
  }

  readState(): DebounceState {
    const file = this.stateFile();
    if (!fs.existsSync(file)) {
      return emptyState();
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<DebounceState>;
      const state = emptyState();
      if (parsed.pendingFiles && typeof parsed.pendingFiles === "object") {
        state.pendingFiles = parsed.pendingFiles;
      }
      state.lastUpdate = parsed.lastUpdate ?? null;
      return state;
    } catch {
      return emptyState();
    }
  }

  writeState(state: DebounceState): void {
    ensureDir(path.dirname(this.stateFile()));
    state.lastUpdate = new Date().toISOString();
    fs.writeFileSync(this.stateFile(), JSON.stringify(state, null, 2), "utf8");
  }

  addFile(filePath: string): void {
    const state = this.readState();
    const rel = normalizeRelativePath(this.workspace, filePath);
    state.pendingFiles[rel] = new Date().toISOString();
    this.writeState(state);
  }

  getFilesReadyToScan(): string[] {
    const state = this.readState();
    const now = Date.now();
    const ready: string[] = [];
    const stillPending: Record<string, string> = {};

    for (const [filePath, timestamp] of Object.entries(state.pendingFiles)) {
      if (!isValidTimestamp(timestamp)) {
        continue;
      }
      const ageMs = now - Date.parse(timestamp);
      if (ageMs >= this.debounceSeconds * 1000) {
        ready.push(filePath);
      } else {
        stillPending[filePath] = timestamp;
      }
    }

    state.pendingFiles = stillPending;
    this.writeState(state);
    return ready;
  }

  wasFilePending(filePath: string): boolean {
    const rel = normalizeRelativePath(this.workspace, filePath);
    return rel in this.readState().pendingFiles;
  }
}
