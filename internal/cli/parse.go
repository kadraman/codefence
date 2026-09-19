package cli

import (
	"fmt"
	"os"
	"strings"
	"time"
)

// ScanOptions holds parsed scan / pre-commit flags.
// Set* fields track which flags were present on the CLI (for later config merge).
type ScanOptions struct {
	Staged bool
	Paths  []string

	Only []string
	Skip []string

	Format  string
	Quiet   bool
	Verbose bool

	DepsProvider    string
	DepsProviderURL string
	DepsRefresh     bool
	DepsCacheTTL    time.Duration
	DepsTimeout     time.Duration
	DepsHTTP2       string
	DepsScope       string

	SecretRules               []string
	SecretDefaultRules        string
	SecretDefaultRulesVersion string
	SecretRulesUpdateURL      string
	SecretRulesRefresh        bool
	SecretRulesCacheTTL       time.Duration
	SecretEntropyThreshold    float64
	SecretMinLength           int
	SecretMinConfidence       string

	// Presence tracking for precedence merge (feature 002).
	SetStaged                    bool
	SetPaths                     bool
	SetOnly                      bool
	SetSkip                      bool
	SetFormat                    bool
	SetQuiet                     bool
	SetVerbose                   bool
	SetDepsProvider              bool
	SetDepsProviderURL           bool
	SetDepsRefresh               bool
	SetDepsCacheTTL              bool
	SetDepsTimeout               bool
	SetDepsHTTP2                 bool
	SetDepsScope                 bool
	SetSecretRules               bool
	SetSecretDefaultRules        bool
	SetSecretDefaultRulesVersion bool
	SetSecretRulesUpdateURL      bool
	SetSecretRulesRefresh        bool
	SetSecretRulesCacheTTL       bool
	SetSecretEntropyThreshold    bool
	SetSecretMinLength           bool
	SetSecretMinConfidence       bool
}

// MCPOptions holds parsed mcp flags.
type MCPOptions struct {
	CWD       string
	Transport string
	LogLevel  string
}

// InstallOptions holds install / install-hooks flags.
type InstallOptions struct {
	DryRun bool
}

// BackgroundScanOptions holds background-scan flags (body in feature 010).
type BackgroundScanOptions struct {
	File string
}

// ScanWorkerOptions holds scan-worker flags (body in feature 010).
type ScanWorkerOptions struct {
	File string
}

type flagKind int

const (
	flagBool flagKind = iota
	flagValue
	flagMulti
)

type flagDef struct {
	name string
	kind flagKind
	set  func(opts *ScanOptions, values []string) error
}

func scanFlagDefs() []flagDef {
	return []flagDef{
		{name: "staged", kind: flagBool, set: func(o *ScanOptions, _ []string) error {
			o.Staged = true
			o.SetStaged = true
			return nil
		}},
		{name: "paths", kind: flagMulti, set: func(o *ScanOptions, vals []string) error {
			if len(vals) == 0 {
				return fmt.Errorf("--paths requires at least one path")
			}
			o.Paths = append(o.Paths, vals...)
			o.SetPaths = true
			return nil
		}},
		{name: "only", kind: flagValue, set: func(o *ScanOptions, vals []string) error {
			aspects, err := parseAspects(vals[0])
			if err != nil {
				return fmt.Errorf("--only: %w", err)
			}
			o.Only = aspects
			o.SetOnly = true
			return nil
		}},
		{name: "skip", kind: flagValue, set: func(o *ScanOptions, vals []string) error {
			aspects, err := parseAspects(vals[0])
			if err != nil {
				return fmt.Errorf("--skip: %w", err)
			}
			o.Skip = aspects
			o.SetSkip = true
			return nil
		}},
		{name: "format", kind: flagValue, set: func(o *ScanOptions, vals []string) error {
			switch vals[0] {
			case "table", "json":
				o.Format = vals[0]
				o.SetFormat = true
				return nil
			default:
				return fmt.Errorf("--format must be table or json")
			}
		}},
		{name: "quiet", kind: flagBool, set: func(o *ScanOptions, _ []string) error {
			o.Quiet = true
			o.SetQuiet = true
			return nil
		}},
		{name: "verbose", kind: flagBool, set: func(o *ScanOptions, _ []string) error {
			o.Verbose = true
			o.SetVerbose = true
			return nil
		}},
		{name: "deps-provider", kind: flagValue, set: func(o *ScanOptions, vals []string) error {
			switch vals[0] {
			case "osv", "custom":
				o.DepsProvider = vals[0]
				o.SetDepsProvider = true
				return nil
			default:
				return fmt.Errorf("--deps-provider must be osv or custom")
			}
		}},
		{name: "deps-provider-url", kind: flagValue, set: func(o *ScanOptions, vals []string) error {
			o.DepsProviderURL = vals[0]
			o.SetDepsProviderURL = true
			return nil
		}},
		{name: "deps-refresh", kind: flagBool, set: func(o *ScanOptions, _ []string) error {
			o.DepsRefresh = true
			o.SetDepsRefresh = true
			return nil
		}},
		{name: "deps-cache-ttl", kind: flagValue, set: func(o *ScanOptions, vals []string) error {
			d, err := parseDuration(vals[0])
			if err != nil {
				return fmt.Errorf("--deps-cache-ttl: %w", err)
			}
			o.DepsCacheTTL = d
			o.SetDepsCacheTTL = true
			return nil
		}},
		{name: "deps-timeout", kind: flagValue, set: func(o *ScanOptions, vals []string) error {
			d, err := parseDuration(vals[0])
			if err != nil {
				return fmt.Errorf("--deps-timeout: %w", err)
			}
			o.DepsTimeout = d
			o.SetDepsTimeout = true
			return nil
		}},
		{name: "deps-http2", kind: flagValue, set: func(o *ScanOptions, vals []string) error {
			switch vals[0] {
			case "auto", "on", "off":
				o.DepsHTTP2 = vals[0]
				o.SetDepsHTTP2 = true
				return nil
			default:
				return fmt.Errorf("--deps-http2 must be auto, on, or off")
			}
		}},
		{name: "deps-scope", kind: flagValue, set: func(o *ScanOptions, vals []string) error {
			switch vals[0] {
			case "changed", "tree":
				o.DepsScope = vals[0]
				o.SetDepsScope = true
				return nil
			default:
				return fmt.Errorf("--deps-scope must be changed or tree")
			}
		}},
		{name: "secret-rules", kind: flagMulti, set: func(o *ScanOptions, vals []string) error {
			if len(vals) == 0 {
				return fmt.Errorf("--secret-rules requires at least one path")
			}
			o.SecretRules = append(o.SecretRules, vals...)
			o.SetSecretRules = true
			return nil
		}},
		{name: "secret-default-rules", kind: flagValue, set: func(o *ScanOptions, vals []string) error {
			switch vals[0] {
			case "on", "off":
				o.SecretDefaultRules = vals[0]
				o.SetSecretDefaultRules = true
				return nil
			default:
				return fmt.Errorf("--secret-default-rules must be on or off")
			}
		}},
		{name: "secret-default-rules-version", kind: flagValue, set: func(o *ScanOptions, vals []string) error {
			o.SecretDefaultRulesVersion = vals[0]
			o.SetSecretDefaultRulesVersion = true
			return nil
		}},
		{name: "secret-rules-update-url", kind: flagValue, set: func(o *ScanOptions, vals []string) error {
			o.SecretRulesUpdateURL = vals[0]
			o.SetSecretRulesUpdateURL = true
			return nil
		}},
		{name: "secret-rules-refresh", kind: flagBool, set: func(o *ScanOptions, _ []string) error {
			o.SecretRulesRefresh = true
			o.SetSecretRulesRefresh = true
			return nil
		}},
		{name: "secret-rules-cache-ttl", kind: flagValue, set: func(o *ScanOptions, vals []string) error {
			d, err := parseDuration(vals[0])
			if err != nil {
				return fmt.Errorf("--secret-rules-cache-ttl: %w", err)
			}
			o.SecretRulesCacheTTL = d
			o.SetSecretRulesCacheTTL = true
			return nil
		}},
		{name: "secret-entropy-threshold", kind: flagValue, set: func(o *ScanOptions, vals []string) error {
			v, err := parseFloat(vals[0])
			if err != nil {
				return fmt.Errorf("--secret-entropy-threshold: %w", err)
			}
			o.SecretEntropyThreshold = v
			o.SetSecretEntropyThreshold = true
			return nil
		}},
		{name: "secret-min-length", kind: flagValue, set: func(o *ScanOptions, vals []string) error {
			v, err := parseInt(vals[0])
			if err != nil {
				return fmt.Errorf("--secret-min-length: %w", err)
			}
			o.SecretMinLength = v
			o.SetSecretMinLength = true
			return nil
		}},
		{name: "secret-min-confidence", kind: flagValue, set: func(o *ScanOptions, vals []string) error {
			switch vals[0] {
			case "low", "medium", "high":
				o.SecretMinConfidence = vals[0]
				o.SetSecretMinConfidence = true
				return nil
			default:
				return fmt.Errorf("--secret-min-confidence must be low, medium, or high")
			}
		}},
	}
}

func flagIndex(defs []flagDef) map[string]flagDef {
	m := make(map[string]flagDef, len(defs))
	for _, d := range defs {
		m[d.name] = d
	}
	return m
}

// parseScanArgs parses scan flags from argv (after the command name).
func parseScanArgs(args []string) (ScanOptions, error) {
	var opts ScanOptions
	defs := flagIndex(scanFlagDefs())
	i := 0
	for i < len(args) {
		a := args[i]
		if a == "-h" || a == "--help" {
			return opts, errHelp
		}
		if !strings.HasPrefix(a, "-") {
			return opts, fmt.Errorf("unexpected argument %q", a)
		}
		name, inline, hasInline, err := splitFlag(a)
		if err != nil {
			return opts, err
		}
		def, ok := defs[name]
		if !ok {
			return opts, fmt.Errorf("unknown flag --%s", name)
		}
		i++
		switch def.kind {
		case flagBool:
			if hasInline {
				switch strings.ToLower(inline) {
				case "1", "true", "on", "yes":
					// ok
				case "0", "false", "off", "no":
					return opts, fmt.Errorf("--%s does not accept value %q", name, inline)
				default:
					return opts, fmt.Errorf("--%s does not accept value %q", name, inline)
				}
			}
			if err := def.set(&opts, nil); err != nil {
				return opts, err
			}
		case flagValue:
			var val string
			if hasInline {
				val = inline
			} else {
				if i >= len(args) || strings.HasPrefix(args[i], "-") {
					return opts, fmt.Errorf("--%s requires a value", name)
				}
				val = args[i]
				i++
			}
			if err := def.set(&opts, []string{val}); err != nil {
				return opts, err
			}
		case flagMulti:
			var vals []string
			if hasInline {
				if inline == "" {
					return opts, fmt.Errorf("--%s requires at least one path", name)
				}
				vals = append(vals, inline)
			}
			for i < len(args) && !strings.HasPrefix(args[i], "-") {
				vals = append(vals, args[i])
				i++
			}
			if err := def.set(&opts, vals); err != nil {
				return opts, err
			}
		}
	}
	return opts, nil
}

func splitFlag(arg string) (name, value string, hasValue bool, err error) {
	if arg == "-" || arg == "--" {
		return "", "", false, fmt.Errorf("invalid flag %q", arg)
	}
	if strings.HasPrefix(arg, "--") {
		body := arg[2:]
		if body == "" {
			return "", "", false, fmt.Errorf("invalid flag %q", arg)
		}
		if i := strings.IndexByte(body, '='); i >= 0 {
			return body[:i], body[i+1:], true, nil
		}
		return body, "", false, nil
	}
	// Single-dash long form is not supported except -h (handled earlier).
	if strings.HasPrefix(arg, "-") && len(arg) > 1 {
		return "", "", false, fmt.Errorf("unknown flag %s (use --%s)", arg, strings.TrimPrefix(arg, "-"))
	}
	return "", "", false, fmt.Errorf("invalid flag %q", arg)
}

func parseMCPArgs(args []string) (MCPOptions, error) {
	opts := MCPOptions{
		Transport: "stdio",
		LogLevel:  "info",
	}
	i := 0
	for i < len(args) {
		a := args[i]
		if a == "-h" || a == "--help" {
			return opts, errHelp
		}
		name, inline, hasInline, err := splitFlag(a)
		if err != nil {
			return opts, err
		}
		i++
		need := func() (string, error) {
			if hasInline {
				return inline, nil
			}
			if i >= len(args) || strings.HasPrefix(args[i], "-") {
				return "", fmt.Errorf("--%s requires a value", name)
			}
			v := args[i]
			i++
			return v, nil
		}
		switch name {
		case "cwd":
			v, err := need()
			if err != nil {
				return opts, err
			}
			opts.CWD = v
		case "transport":
			v, err := need()
			if err != nil {
				return opts, err
			}
			if v != "stdio" {
				return opts, fmt.Errorf("--transport %q not supported (v1 supports stdio only)", v)
			}
			opts.Transport = v
		case "log-level":
			v, err := need()
			if err != nil {
				return opts, err
			}
			switch v {
			case "error", "warn", "info", "debug":
				opts.LogLevel = v
			default:
				return opts, fmt.Errorf("--log-level must be error, warn, info, or debug")
			}
		default:
			return opts, fmt.Errorf("unknown flag --%s", name)
		}
	}
	if opts.CWD == "" {
		wd, err := os.Getwd()
		if err != nil {
			return opts, fmt.Errorf("resolve process cwd: %w", err)
		}
		opts.CWD = wd
	}
	return opts, nil
}

func parseInstallArgs(args []string) (InstallOptions, error) {
	var opts InstallOptions
	for i := 0; i < len(args); i++ {
		a := args[i]
		if a == "-h" || a == "--help" {
			return opts, errHelp
		}
		name, inline, hasInline, err := splitFlag(a)
		if err != nil {
			return opts, err
		}
		switch name {
		case "dry-run":
			if hasInline {
				switch strings.ToLower(inline) {
				case "1", "true", "on", "yes":
					opts.DryRun = true
				default:
					return opts, fmt.Errorf("--dry-run does not accept value %q", inline)
				}
			} else {
				opts.DryRun = true
			}
		default:
			return opts, fmt.Errorf("unknown flag --%s", name)
		}
	}
	return opts, nil
}

func parseBackgroundScanArgs(args []string) (BackgroundScanOptions, error) {
	var opts BackgroundScanOptions
	i := 0
	for i < len(args) {
		a := args[i]
		if a == "-h" || a == "--help" {
			return opts, errHelp
		}
		name, inline, hasInline, err := splitFlag(a)
		if err != nil {
			return opts, err
		}
		i++
		switch name {
		case "file":
			var v string
			if hasInline {
				v = inline
			} else {
				if i >= len(args) || strings.HasPrefix(args[i], "-") {
					return opts, fmt.Errorf("--file requires a value")
				}
				v = args[i]
				i++
			}
			opts.File = v
		default:
			return opts, fmt.Errorf("unknown flag --%s", name)
		}
	}
	return opts, nil
}

func parseScanWorkerArgs(args []string) (ScanWorkerOptions, error) {
	var opts ScanWorkerOptions
	i := 0
	for i < len(args) {
		a := args[i]
		if a == "-h" || a == "--help" {
			return opts, errHelp
		}
		name, inline, hasInline, err := splitFlag(a)
		if err != nil {
			return opts, err
		}
		i++
		switch name {
		case "file":
			var v string
			if hasInline {
				v = inline
			} else {
				if i >= len(args) || strings.HasPrefix(args[i], "-") {
					return opts, fmt.Errorf("--file requires a value")
				}
				v = args[i]
				i++
			}
			opts.File = v
		default:
			return opts, fmt.Errorf("unknown flag --%s", name)
		}
	}
	return opts, nil
}
