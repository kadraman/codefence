import fs from "node:fs";
import path from "node:path";

/** Locate package root (directory containing templates/ai and package.json). */
export function packageRootFromModule(): string {
  let dir = __dirname;
  while (dir !== path.dirname(dir)) {
    if (
      fs.existsSync(path.join(dir, "package.json")) &&
      (fs.existsSync(path.join(dir, "hooks", "git", "pre-commit")) ||
        fs.existsSync(path.join(dir, "templates", "ai")))
    ) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  throw new Error("Could not locate package root for hooks/");
}
