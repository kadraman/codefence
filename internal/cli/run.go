package cli

import (
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
)

// IO streams for the CLI (overridable in tests).
var (
	Stdout io.Writer = os.Stdout
	Stderr io.Writer = os.Stderr
)

// Main runs the CLI with argv excluding the program name. Returns a process exit code.
func Main(args []string) int {
	if len(args) == 0 {
		writeRootHelp(Stdout)
		return ExitOK
	}

	cmd := args[0]
	rest := args[1:]

	if cmd == "-h" || cmd == "--help" {
		writeRootHelp(Stdout)
		return ExitOK
	}

	switch cmd {
	case "scan":
		return runScanCommand(rest, false)
	case "pre-commit":
		return runScanCommand(rest, true)
	case "mcp":
		return runMCPCommand(rest)
	case "version":
		return runVersionCommand(rest)
	case "check-deps":
		return runCheckDepsCommand(rest)
	case "install":
		return runInstallCommand(rest)
	case "install-hooks":
		return runInstallHooksCommand(rest)
	case "background-scan":
		return runBackgroundScanCommand(rest)
	case "scan-worker":
		return runScanWorkerCommand(rest)
	default:
		writeUsageError(Stderr, fmt.Sprintf("unknown command %q", cmd))
		return ExitUsage
	}
}

func runScanCommand(args []string, forceStaged bool) int {
	opts, err := parseScanArgs(args)
	if errors.Is(err, errHelp) {
		if forceStaged {
			writePreCommitHelp(Stdout)
		} else {
			writeScanHelp(Stdout)
		}
		return ExitOK
	}
	if err != nil {
		writeCmdError(Stderr, err)
		if forceStaged {
			writePreCommitHelp(Stderr)
		} else {
			writeScanHelp(Stderr)
		}
		return ExitUsage
	}
	if forceStaged {
		opts.Staged = true
		opts.SetStaged = true
	}
	return dispatchScan(opts)
}

func runMCPCommand(args []string) int {
	opts, err := parseMCPArgs(args)
	if errors.Is(err, errHelp) {
		writeMCPHelp(Stdout)
		return ExitOK
	}
	if err != nil {
		writeCmdError(Stderr, err)
		writeMCPHelp(Stderr)
		return ExitUsage
	}
	return dispatchMCP(opts)
}

func runVersionCommand(args []string) int {
	for _, a := range args {
		if a == "-h" || a == "--help" {
			writeVersionHelp(Stdout)
			return ExitOK
		}
		writeCmdError(Stderr, fmt.Errorf("unexpected argument %q", a))
		writeVersionHelp(Stderr)
		return ExitUsage
	}
	printVersion()
	return ExitOK
}

func runCheckDepsCommand(args []string) int {
	for _, a := range args {
		if a == "-h" || a == "--help" {
			writeCheckDepsHelp(Stdout)
			return ExitOK
		}
		writeCmdError(Stderr, fmt.Errorf("unexpected argument %q", a))
		writeCheckDepsHelp(Stderr)
		return ExitUsage
	}
	fmt.Fprintln(Stdout, "check-deps was removed; use: codefence scan --only deps")
	return ExitOK
}

func runInstallCommand(args []string) int {
	opts, err := parseInstallArgs(args)
	if errors.Is(err, errHelp) {
		writeInstallHelp(Stdout)
		return ExitOK
	}
	if err != nil {
		writeCmdError(Stderr, err)
		writeInstallHelp(Stderr)
		return ExitUsage
	}
	return dispatchInstall(opts)
}

func runInstallHooksCommand(args []string) int {
	opts, err := parseInstallArgs(args)
	if errors.Is(err, errHelp) {
		writeInstallHooksHelp(Stdout)
		return ExitOK
	}
	if err != nil {
		writeCmdError(Stderr, err)
		writeInstallHooksHelp(Stderr)
		return ExitUsage
	}
	return dispatchInstallHooks(opts)
}

func runBackgroundScanCommand(args []string) int {
	opts, err := parseBackgroundScanArgs(args)
	if errors.Is(err, errHelp) {
		writeBackgroundScanHelp(Stdout)
		return ExitOK
	}
	if err != nil {
		writeCmdError(Stderr, err)
		writeBackgroundScanHelp(Stderr)
		return ExitUsage
	}
	return dispatchBackgroundScan(opts)
}

func runScanWorkerCommand(args []string) int {
	opts, err := parseScanWorkerArgs(args)
	if errors.Is(err, errHelp) {
		writeScanWorkerHelp(Stdout)
		return ExitOK
	}
	if err != nil {
		writeCmdError(Stderr, err)
		writeScanWorkerHelp(Stderr)
		return ExitUsage
	}
	return dispatchScanWorker(opts)
}

func writeCmdError(w io.Writer, err error) {
	fmt.Fprintf(w, "error: %s\n\n", strings.TrimSpace(err.Error()))
}

// dispatchScan is the scan library entry point. Stub until feature 005.
func dispatchScan(opts ScanOptions) int {
	_ = opts
	return ExitOK
}

// dispatchMCP is the MCP server entry. Stub until feature 012.
func dispatchMCP(opts MCPOptions) int {
	_ = opts
	return ExitOK
}

// dispatchInstall is the AI install entry. Stub until feature 011.
func dispatchInstall(opts InstallOptions) int {
	if opts.DryRun {
		fmt.Fprintln(Stdout, "install: dry-run (no files written)")
	}
	return ExitOK
}

// dispatchInstallHooks is the hooks install entry. Stub until feature 010.
func dispatchInstallHooks(opts InstallOptions) int {
	if opts.DryRun {
		fmt.Fprintln(Stdout, "install-hooks: dry-run (no files written)")
	}
	return ExitOK
}

// dispatchBackgroundScan stub until feature 010.
func dispatchBackgroundScan(opts BackgroundScanOptions) int {
	_ = opts
	return ExitOK
}

// dispatchScanWorker stub until feature 010.
func dispatchScanWorker(opts ScanWorkerOptions) int {
	_ = opts
	return ExitOK
}
