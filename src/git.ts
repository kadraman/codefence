import { spawnSync } from "node:child_process";

export function getChangedFiles(staged = false): string[] {
  const args = staged
    ? ["diff", "--name-only", "--cached", "--diff-filter=ACMRTUXB"]
    : ["diff", "--name-only", "--diff-filter=ACMRTUXB"];

  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0 || !result.stdout) {
    return [];
  }

  return result.stdout
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean);
}
