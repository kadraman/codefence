import fs from "node:fs";
import path from "node:path";
import { CLI_NAME, cliInvocation } from "../cliName";
import { packageRootFromModule } from "./packageRoot";

export interface InstallHooksResult {
  path: string;
  action: "installed" | "skipped" | "exists";
  note?: string;
}

function repoHooksDir(): string {
  return path.join(packageRootFromModule(), "hooks");
}

function copyFile(source: string, target: string, dryRun: boolean): InstallHooksResult {
  if (fs.existsSync(target)) {
    const existing = fs.readFileSync(target, "utf8");
    const next = fs.readFileSync(source, "utf8");
    if (existing === next) {
      return { path: target, action: "exists", note: "already up to date" };
    }
  }

  if (!dryRun) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    try {
      fs.chmodSync(target, 0o755);
    } catch {
      // Windows may ignore chmod.
    }
  }

  return { path: target, action: "installed" };
}

function writeFile(target: string, content: string, dryRun: boolean): InstallHooksResult {
  if (fs.existsSync(target)) {
    const existing = fs.readFileSync(target, "utf8");
    if (existing === content) {
      return { path: target, action: "exists", note: "already up to date" };
    }
  }

  if (!dryRun) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf8");
    try {
      fs.chmodSync(target, 0o755);
    } catch {
      // ignore
    }
  }

  return { path: target, action: "installed" };
}

function resolveBackgroundScanScript(workspace: string): string {
  const fromNodeModules = path.join(workspace, "node_modules", "codefence", "hooks", "bin", "background-scan.cjs");
  const fromLegacyScoped = path.join(
    workspace,
    "node_modules",
    "@kadraman",
    "codefence",
    "hooks",
    "bin",
    "background-scan.cjs"
  );
  if (fs.existsSync(fromNodeModules)) {
    return fromNodeModules;
  }
  if (fs.existsSync(fromLegacyScoped)) {
    return fromLegacyScoped;
  }

  return path.join(packageRootFromModule(), "hooks", "bin", "background-scan.cjs");
}

function quoteForHookCommand(filePath: string): string {
  return `node "${filePath.replace(/\\/g, "/")}"`;
}

function buildIdeHooksJson(workspace: string): string {
  const command = quoteForHookCommand(resolveBackgroundScanScript(workspace));
  return JSON.stringify(
    {
      version: 1,
      hooks: {
        afterFileEdit: [
          {
            command,
            timeout: 60
          }
        ]
      }
    },
    null,
    2
  );
}

function writeJsonIfMissing(target: string, content: string, dryRun: boolean): InstallHooksResult {
  if (fs.existsSync(target)) {
    return { path: target, action: "skipped", note: "file exists — not overwritten" };
  }

  if (!dryRun) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf8");
  }

  return { path: target, action: "installed" };
}

function installGitPreCommitHook(workspace: string, hooksRoot: string, dryRun: boolean): InstallHooksResult[] {
  const gitHooksDir = path.join(workspace, ".git", "hooks");
  const libSrc = path.join(hooksRoot, "lib", "run-codefence-hook.cjs");
  const libDest = path.join(gitHooksDir, "codefence-run-hook.cjs");

  const hookContent = `#!/usr/bin/env node
"use strict";
const { runHook } = require("./codefence-run-hook.cjs");
runHook("pre-commit", process.argv.slice(2));
`;

  const hookDest = path.join(gitHooksDir, "pre-commit");
  const results: InstallHooksResult[] = [];

  results.push(copyFile(libSrc, libDest, dryRun));
  results.push(
    writeFile(hookDest, hookContent, dryRun)
  );

  if (process.platform === "win32") {
    const cmdSrc = path.join(hooksRoot, "git", "pre-commit.cmd");
    const cmdDest = path.join(gitHooksDir, "pre-commit.cmd");
    if (fs.existsSync(cmdSrc)) {
      results.push({
        ...copyFile(cmdSrc, cmdDest, dryRun),
        note: "optional Windows cmd helper (Git uses pre-commit without extension)"
      });
    }
  }

  return results;
}

export function installHooks(cwd: string, dryRun = false): InstallHooksResult[] {
  const workspace = path.resolve(cwd);
  const gitDir = path.join(workspace, ".git");
  if (!fs.existsSync(gitDir)) {
    throw new Error("Not a git repository (no .git directory). Run from your project root.");
  }

  const hooksRoot = repoHooksDir();
  const results: InstallHooksResult[] = [];

  results.push(
    ...installGitPreCommitHook(workspace, hooksRoot, dryRun).map((r) => ({
      ...r,
      path: path.relative(workspace, r.path) || r.path
    }))
  );

  const ideHooksJson = buildIdeHooksJson(workspace);

  const kiroDest = path.join(workspace, ".kiro", "hooks.json");
  results.push({
    ...writeJsonIfMissing(kiroDest, ideHooksJson, dryRun),
    path: path.relative(workspace, kiroDest) || kiroDest
  });

  const cursorDest = path.join(workspace, ".cursor", "hooks.json");
  results.push({
    ...writeJsonIfMissing(cursorDest, ideHooksJson, dryRun),
    path: path.relative(workspace, cursorDest) || cursorDest
  });

  return results;
}

export function printInstallHooksHelp(): void {
  console.log(`Usage: ${cliInvocation("install-hooks", "[--dry-run]")}

Install cross-platform Git and IDE hooks (Node.js — works on Windows, macOS, Linux).

Installs:
  .git/hooks/pre-commit       Node hook → ${cliInvocation("pre-commit")}
  .git/hooks/codefence-run-hook.cjs Shared resolver (copied with pre-commit)
  .kiro/hooks.json            afterFileEdit → node .../background-scan.cjs (if missing)
  .cursor/hooks.json          same (if missing)

Requires Node.js on PATH (same as ${CLI_NAME}).

Examples:
  ${cliInvocation("install-hooks")}
  ${cliInvocation("install-hooks", "--dry-run")}
`);
}
