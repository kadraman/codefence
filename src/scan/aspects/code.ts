import path from "node:path";
import { scanFiles, shouldScanFile } from "../../scanner";
import { printUnifiedFindings, writeScanLog, writeScanStatus } from "../output";
import { AspectOutcome, ScanAspect, ScanContext } from "../types";

export const codeAspect: ScanAspect = {
  id: "code",
  label: "Local secure-coding rules",
  async run(context: ScanContext): Promise<AspectOutcome> {
    const sourceFiles = context.files
      .filter((file) =>
        shouldScanFile(file, {
          cwd: context.cwd,
          allowIgnored: context.explicitPaths,
          ignoredPrefixes: context.options.gitIgnoredPrefixes
        })
      )
      .map((file) => path.resolve(context.cwd, file));

    if (sourceFiles.length === 0) {
      return {
        aspect: "code",
        status: "skipped",
        exitCode: 0,
        message: "No scannable source files in the change set."
      };
    }

    const findings = await scanFiles(sourceFiles, {
      workspace: context.cwd,
      secret: context.options.secret
    });

    if (findings.length === 0) {
      writeScanStatus(`[code] No findings in ${sourceFiles.length} file(s).`, context.options);
      return { aspect: "code", status: "ok", exitCode: 0 };
    }

    writeScanLog(`[code] ${findings.length} finding(s):`, context.options);
    printUnifiedFindings("code", findings, context.options.outputFormat, context.cwd);

    return {
      aspect: "code",
      status: "failed",
      exitCode: 1,
      message: `${findings.length} secure-coding finding(s)`
    };
  }
};
