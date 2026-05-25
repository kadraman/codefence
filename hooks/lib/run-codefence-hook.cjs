"use strict";

const { spawnSync, execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

/**
 * Cross-platform helper for Git / IDE hooks (Windows, macOS, Linux).
 * Resolves codefence CLI and runs with repo root as cwd.
 */

function gitRepoRoot(startDir) {
  try {
    return execSync("git rev-parse --show-toplevel", {
      encoding: "utf8",
      cwd: startDir
    }).trim();
  } catch {
    return startDir;
  }
}

function resolveCliScript(repoRoot) {
  const candidates = [
    path.join(repoRoot, "node_modules", "codefence", "dist", "src", "cli.js"),
    path.join(repoRoot, "node_modules", "@kadraman", "codefence", "dist", "src", "cli.js"),
    path.join(repoRoot, "dist", "src", "cli.js"),
    path.join(__dirname, "..", "..", "dist", "src", "cli.js")
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function runCodefence(repoRoot, codefenceArgs) {
  const cli = resolveCliScript(repoRoot);

  if (cli) {
    return spawnSync(process.execPath, [cli, ...codefenceArgs], {
      cwd: repoRoot,
      stdio: "inherit",
      env: process.env
    });
  }

  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  return spawnSync(npx, ["--yes", "--package=codefence", "codefence", ...codefenceArgs], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32"
  });
}

function runHook(codefenceCommand, extraArgs = []) {
  const repoRoot = gitRepoRoot(process.cwd());
  const result = runCodefence(repoRoot, [codefenceCommand, ...extraArgs]);
  const code = typeof result.status === "number" ? result.status : 1;

  if (result.error) {
    console.error(`[codefence hook] Failed to run: ${result.error.message}`);
    process.exit(1);
  }

  process.exit(code);
}

module.exports = { gitRepoRoot, resolveCliScript, runCodefence, runHook };
