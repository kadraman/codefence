#!/usr/bin/env node
import { cliInvocation } from "./cliName";
import { printScanHelp, parseScanArgv } from "./scan/parseOptions";
import { runScan } from "./scan/runner";
import { installAssistantRules, printInstallHelp } from "./install/assistantRules";
import { parseBackgroundScanArgv, runBackgroundScan } from "./hooks/backgroundScanner";
import { installHooks, printInstallHooksHelp } from "./hooks/installHooks";
import { runPreCommit } from "./hooks/preCommit";
import { parseScanWorkerArgv, runScanWorker } from "./hooks/scanWorker";

function runInstall(rest: string[]): number {
  if (rest.includes("-h") || rest.includes("--help")) {
    printInstallHelp();
    return 0;
  }
  const dryRun = rest.includes("--dry-run");
  const results = installAssistantRules({ dryRun });
  const label = dryRun ? "[dry-run] " : "";
  for (const r of results) {
    const note = r.note ? ` (${r.note})` : "";
    console.log(`${label}${r.path}: ${r.action}${note}`);
  }
  console.log(
    dryRun
      ? `\nNo files written. Run \`${cliInvocation("install")}\` to apply.`
      : "\nDone. Existing instructions outside the codefence-guardrails markers were preserved."
  );
  return 0;
}

function runInstallHooks(rest: string[]): number {
  if (rest.includes("-h") || rest.includes("--help")) {
    printInstallHooksHelp();
    return 0;
  }
  const dryRun = rest.includes("--dry-run");
  try {
    const results = installHooks(process.cwd(), dryRun);
    const label = dryRun ? "[dry-run] " : "";
    for (const r of results) {
      const note = r.note ? ` (${r.note})` : "";
      console.log(`${label}${r.path}: ${r.action}${note}`);
    }
    console.log(
      dryRun
        ? `\nNo files written. Run \`${cliInvocation("install-hooks")}\` to apply.`
        : "\nGit pre-commit installed. IDE hook configs created if missing."
    );
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return 1;
  }
}

function printUsage(): void {
  console.log(`Usage:
  ${cliInvocation("scan", "[options]")}              Run guardrail scan aspects
  ${cliInvocation("pre-commit")}                  Git pre-commit (runs ${cliInvocation("scan", "--staged")})
  ${cliInvocation("background-scan", "[options]")}   IDE hook: queue debounced background scans
  ${cliInvocation("scan-worker", "--type ...")}      Internal worker (used by background-scan)
  ${cliInvocation("install", "[--dry-run]")}         Merge AI assistant instruction files
  ${cliInvocation("install-hooks", "[--dry-run]")}   Install .git/hooks/pre-commit + IDE hooks

Run \`${cliInvocation("scan", "--help")}\` for scan options.
`);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);

  if (command === "install") {
    process.exit(runInstall(rest));
  }

  if (command === "install-hooks") {
    process.exit(runInstallHooks(rest));
  }

  if (command === "pre-commit") {
    process.exit(await runPreCommit());
  }

  if (command === "background-scan") {
    if (rest.includes("-h") || rest.includes("--help")) {
      console.log(`Usage: ${cliInvocation("background-scan", "[--file <path>] [--workspace <dir>] [--check-pending]")}
`);
      process.exit(0);
    }
    process.exit(runBackgroundScan(parseBackgroundScanArgv(rest)));
  }

  if (command === "scan-worker") {
    const options = parseScanWorkerArgv(rest);
    if (!options) {
      console.error(`Usage: ${cliInvocation("scan-worker", "--target <path> [--workspace <dir>]")}`);
      process.exit(1);
    }
    process.exit(await runScanWorker(options));
  }

  if (command === "check-deps") {
    console.error(`check-deps was removed; use: ${cliInvocation("scan", "[--staged]")}`);
    process.exit(1);
  }

  if (command !== "scan") {
    printUsage();
    process.exit(1);
  }

  let parsed;
  try {
    parsed = parseScanArgv(rest);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }

  if ("help" in parsed) {
    printScanHelp();
    process.exit(0);
  }

  process.exit(await runScan(parsed));
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
