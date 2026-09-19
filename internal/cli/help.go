package cli

import (
	"errors"
	"fmt"
	"io"
	"strings"
)

var errHelp = errors.New("help requested")

const envMirrorList = `CODEFENCE_ASPECTS, CODEFENCE_ONLY, CODEFENCE_SKIP, CODEFENCE_FORMAT, CODEFENCE_QUIET, CODEFENCE_VERBOSE, CODEFENCE_GIT_IGNORED_PREFIXES, CODEFENCE_DEPS_PROVIDER, CODEFENCE_DEPS_PROVIDER_URL, CODEFENCE_DEPS_REFRESH, CODEFENCE_DEPS_CACHE_TTL, CODEFENCE_DEPS_TIMEOUT, CODEFENCE_DEPS_HTTP2, CODEFENCE_DEPS_SCOPE, CODEFENCE_SECRET_RULES, CODEFENCE_SECRET_DEFAULT_RULES, CODEFENCE_SECRET_DEFAULT_RULES_VERSION, CODEFENCE_SECRET_RULES_UPDATE_URL, CODEFENCE_SECRET_RULES_REFRESH, CODEFENCE_SECRET_RULES_CACHE_TTL, CODEFENCE_SECRET_ENTROPY_THRESHOLD, CODEFENCE_SECRET_MIN_LENGTH, CODEFENCE_SECRET_MIN_CONFIDENCE`

func writeRootHelp(w io.Writer) {
	fmt.Fprint(w, `codefence — security scanning CLI for AI-assisted coding

Usage:
  codefence <command> [flags]

Commands:
  scan             Scan git-changed or explicit paths
  pre-commit       Equivalent to scan --staged (Git hook)
  background-scan  IDE save debounce entry (spawns scan-worker)
  scan-worker      Background worker for a single file scan
  install          Merge AI assistant guardrail files
  install-hooks    Install Git pre-commit and IDE hooks
  mcp              Start MCP stdio server for agents
  version          Print version and commit
  check-deps       Redirect to scan (removed command)

Use "codefence <command> --help" for command help.
`)
}

func writeScanHelp(w io.Writer) {
	fmt.Fprint(w, `Usage:
  codefence scan [flags]

Scan git-changed files (default) or explicit paths for secrets, secure-coding
issues (aspect "code"), and dependency vulnerabilities (aspect "deps").

Aspects:
  code   Secure-coding line rules + secret engine (default)
  deps   Manifest extraction + OSV vulnerability query

Git-based scans skip paths whose prefixes appear in paths.git_ignored_prefixes
(config / CODEFENCE_GIT_IGNORED_PREFIXES; often includes examples/). Explicit
--paths still scan those files.

Flags:
  --staged                         Scan staged git files
  --paths <files...>               Scan explicit paths (bypass git discovery)
  --only <aspects>                 Run only listed aspects (comma-separated: code,deps)
  --skip <aspects>                 Skip selected aspects (comma-separated: code,deps)
  --format <table|json>            Output format (default: table)
  --quiet                          Suppress progress messages
  --verbose                        Show progress on stderr
  --deps-provider <osv|custom>     Dependency vulnerability provider
  --deps-provider-url <url>        Override provider API endpoint
  --deps-refresh                   Ignore deps cache and re-query
  --deps-cache-ttl <dur>           Deps cache TTL (e.g. 24h, 30m, 15s)
  --deps-timeout <dur>             Provider request timeout
  --deps-http2 <auto|on|off>       HTTP/2 for deps API
  --deps-scope <changed|tree>      Manifest scope (default: changed)
  --secret-rules <path...>         Extra Semgrep-style YAML secret rules
  --secret-default-rules <on|off>  Enable or disable bundled secret rules
  --secret-default-rules-version <v>
  --secret-rules-update-url <url>  Remote YAML rule bundle URL
  --secret-rules-refresh           Force remote rule refresh
  --secret-rules-cache-ttl <dur>   Remote rules cache TTL
  --secret-entropy-threshold <n>   Entropy detection sensitivity
  --secret-min-length <n>          Min length for entropy candidates
  --secret-min-confidence <low|medium|high>
  -h, --help                       Show this help

Environment mirrors (CLI flags override env; env overrides codefence-config.yml):
  `+envMirrorList+`
`)
}

func writePreCommitHelp(w io.Writer) {
	fmt.Fprint(w, `Usage:
  codefence pre-commit [flags]

Equivalent to "codefence scan --staged". Accepts the same flags as scan
(additional --staged is redundant).

  -h, --help   Show this help
`)
}

func writeMCPHelp(w io.Writer) {
	fmt.Fprint(w, `Usage:
  codefence mcp [flags]

Start the MCP server for AI agents (stdio transport only in v1).

Flags:
  --cwd <path>                      Working directory (default: process cwd)
  --transport stdio                 Transport (only stdio is supported)
  --log-level <error|warn|info|debug>
                                    Log level on stderr (default: info)
  -h, --help                        Show this help
`)
}

func writeVersionHelp(w io.Writer) {
	fmt.Fprint(w, `Usage:
  codefence version

Print build version and commit.

  -h, --help   Show this help
`)
}

func writeCheckDepsHelp(w io.Writer) {
	fmt.Fprint(w, `Usage:
  codefence check-deps

Removed. Use "codefence scan" (for example: codefence scan --only deps).

  -h, --help   Show this help
`)
}

func writeInstallHelp(w io.Writer) {
	fmt.Fprint(w, `Usage:
  codefence install [flags]

Merge AI assistant guardrail files (Cursor, Claude Code, GitHub Copilot).

Flags:
  --dry-run    Show what would be written without changing files
  -h, --help   Show this help
`)
}

func writeInstallHooksHelp(w io.Writer) {
	fmt.Fprint(w, `Usage:
  codefence install-hooks [flags]

Install Git pre-commit and IDE background-scan hooks.

Flags:
  --dry-run    Show what would be written without changing files
  -h, --help   Show this help
`)
}

func writeBackgroundScanHelp(w io.Writer) {
	fmt.Fprint(w, `Usage:
  codefence background-scan [flags]

Debounced IDE save entry that spawns scan-worker.

Flags:
  --file <path>   File path to scan
  -h, --help      Show this help
`)
}

func writeScanWorkerHelp(w io.Writer) {
	fmt.Fprint(w, `Usage:
  codefence scan-worker [flags]

Background worker for a single-file scan.

Flags:
  --file <path>   File path to scan
  -h, --help      Show this help
`)
}

func writeUsageError(w io.Writer, msg string) {
	msg = strings.TrimSpace(msg)
	if msg != "" {
		fmt.Fprintf(w, "error: %s\n\n", msg)
	}
	writeRootHelp(w)
}
