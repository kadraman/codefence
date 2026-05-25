import path from "node:path";
import { scanFiles, shouldScanFile } from "../../scanner";
import { AspectOutcome, ScanAspect, ScanContext } from "../types";

export const codeAspect: ScanAspect = {
  id: "code",
  label: "Local secure-coding rules",
  run(context: ScanContext): AspectOutcome {
    const sourceFiles = context.files
      .filter((file) =>
        shouldScanFile(file, { cwd: context.cwd, allowIgnored: context.explicitPaths })
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

    const findings = scanFiles(sourceFiles);

    if (findings.length === 0) {
      console.log(`[code] No findings in ${sourceFiles.length} file(s).`);
      return { aspect: "code", status: "ok", exitCode: 0 };
    }

    console.error(`[code] ${findings.length} finding(s):`);
    for (const finding of findings) {
      console.error(
        `  ${finding.severity.toUpperCase()} ${finding.ruleId} ${finding.filePath}:${finding.line} - ${finding.message}`
      );
    }

    return {
      aspect: "code",
      status: "failed",
      exitCode: 1,
      message: `${findings.length} secure-coding finding(s)`
    };
  }
};
