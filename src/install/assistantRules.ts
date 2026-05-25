import fs from "node:fs";
import path from "node:path";
import { cliInvocation } from "../cliName";
import { mergeMarkedBlock, MergeAction } from "./markers";

export interface InstallResult {
  path: string;
  action: MergeAction | "written" | "skipped";
  note?: string;
}

export interface InstallOptions {
  cwd?: string;
  dryRun?: boolean;
}

const MARKDOWN_TARGETS = [
  { rel: "AGENTS.md", template: "AGENTS.md", useFragment: false },
  { rel: path.join(".claude", "CLAUDE.md"), template: "sast-guardrails.fragment.md", useFragment: true },
  {
    rel: path.join(".github", "copilot-instructions.md"),
    template: "sast-guardrails.fragment.md",
    useFragment: true
  }
] as const;

const CURSOR_RULE = {
  rel: path.join(".cursor", "rules", "sast-guardrails.mdc"),
  template: "sast-guardrails.mdc"
} as const;

function packageRoot(): string {
  let dir = __dirname;
  while (dir !== path.dirname(dir)) {
    if (
      fs.existsSync(path.join(dir, "package.json")) &&
      fs.existsSync(path.join(dir, "templates", "ai"))
    ) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  throw new Error("Could not locate package root (templates/ai missing)");
}

function templatesDir(): string {
  return path.join(packageRoot(), "templates", "ai");
}

function readTemplate(name: string): string {
  const filePath = path.join(templatesDir(), name);
  return fs.readFileSync(filePath, "utf8");
}

function ensureParentDir(filePath: string, dryRun: boolean): void {
  if (dryRun) {
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function installMarkdownMerge(
  cwd: string,
  rel: string,
  templateName: string,
  useFragment: boolean,
  dryRun: boolean
): InstallResult {
  const target = path.join(cwd, rel);
  const fragment = useFragment ? readTemplate("sast-guardrails.fragment.md") : readTemplate(templateName);
  const existing = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";

  let content: string;
  let action: MergeAction;

  if (!existing.trim() && useFragment) {
    const full = readTemplate("AGENTS.md");
    content = full;
    action = "created";
  } else if (!existing.trim()) {
    content = fragment;
    action = "created";
  } else {
    const merged = mergeMarkedBlock(existing, fragment);
    content = merged.content;
    action = merged.action;
  }

  if (action !== "unchanged") {
    ensureParentDir(target, dryRun);
    if (!dryRun) {
      fs.writeFileSync(target, content, "utf8");
    }
  }

  return {
    path: rel,
    action: action === "unchanged" ? "unchanged" : action,
    note: existing.trim() ? "merged marked section only" : "created new file"
  };
}

function installCursorRule(cwd: string, dryRun: boolean): InstallResult {
  const rel = CURSOR_RULE.rel;
  const target = path.join(cwd, rel);
  const content = readTemplate(CURSOR_RULE.template);
  let action: InstallResult["action"] = "written";

  if (fs.existsSync(target)) {
    const existing = fs.readFileSync(target, "utf8");
    if (existing === content) {
      action = "unchanged";
    } else {
      action = "updated" as InstallResult["action"];
    }
  }

  if (action !== "unchanged") {
    ensureParentDir(target, dryRun);
    if (!dryRun) {
      fs.writeFileSync(target, content, "utf8");
    }
  }

  return {
    path: rel,
    action,
    note: "separate rule file; your other .cursor/rules/* files are not modified"
  };
}

function installGitignore(cwd: string, dryRun: boolean): InstallResult {
  const target = path.join(cwd, ".gitignore");
  const entry = ".codefence/";

  if (!fs.existsSync(target)) {
    if (!dryRun) {
      fs.writeFileSync(target, `${entry}\n`, "utf8");
    }
    return { path: ".gitignore", action: "created", note: `added ${entry}` };
  }

  const content = fs.readFileSync(target, "utf8");
  if (
    content.split(/\r?\n/).some(
      (line) =>
        line.trim() === entry ||
        line.trim() === ".codefence" ||
        line.trim() === ".dsec/" ||
        line.trim() === ".dsec" ||
        line.trim() === ".fgr"
    )
  ) {
    return { path: ".gitignore", action: "unchanged" };
  }

  const next = content.endsWith("\n") ? `${content}${entry}\n` : `${content}\n${entry}\n`;
  if (!dryRun) {
    fs.writeFileSync(target, next, "utf8");
  }
  return { path: ".gitignore", action: "appended", note: `added ${entry}` };
}

export function installAssistantRules(options: InstallOptions = {}): InstallResult[] {
  const cwd = options.cwd ?? process.cwd();
  const dryRun = options.dryRun ?? false;
  const results: InstallResult[] = [];

  for (const target of MARKDOWN_TARGETS) {
    results.push(
      installMarkdownMerge(cwd, target.rel, target.template, target.useFragment, dryRun)
    );
  }

  results.push(installCursorRule(cwd, dryRun));
  results.push(installGitignore(cwd, dryRun));

  return results;
}

export function printInstallHelp(): void {
  console.log(`Usage: ${cliInvocation("install", "[options]")}

Install AI assistant instructions without overwriting your existing config.

Options:
  --dry-run    Show what would change without writing files
  -h, --help   Show this help

Behavior:
  - AGENTS.md / .claude/CLAUDE.md / .github/copilot-instructions.md
      → If missing: create with SAST guardrails section
      → If present: append or update ONLY the block between
        <!-- sast-guardrails:start --> ... <!-- sast-guardrails:end -->
  - .cursor/rules/sast-guardrails.mdc
      → Always its own file (never overwrites your other .mdc rules)
  - .gitignore → appends .codefence/ if not already listed

Examples:
  ${cliInvocation("install")}
  ${cliInvocation("install", "--dry-run")}
`);
}
