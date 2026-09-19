package cli

import (
	"strings"
	"testing"
	"time"
)

func TestParseDuration(t *testing.T) {
	t.Parallel()
	cases := []struct {
		in   string
		want time.Duration
		ok   bool
	}{
		{"24h", 24 * time.Hour, true},
		{"30m", 30 * time.Minute, true},
		{"15s", 15 * time.Second, true},
		{"1h30m", time.Hour + 30*time.Minute, true},
		{"", 0, false},
		{"nope", 0, false},
		{"24", 0, false},
	}
	for _, tc := range cases {
		tc := tc
		t.Run(tc.in, func(t *testing.T) {
			t.Parallel()
			got, err := parseDuration(tc.in)
			if tc.ok {
				if err != nil {
					t.Fatalf("parseDuration(%q): %v", tc.in, err)
				}
				if got != tc.want {
					t.Fatalf("got %v want %v", got, tc.want)
				}
			} else if err == nil {
				t.Fatalf("expected error for %q", tc.in)
			}
		})
	}
}

func TestParseScanArgs_HappyPaths(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name string
		args []string
		check func(t *testing.T, o ScanOptions)
	}{
		{
			name: "staged",
			args: []string{"--staged"},
			check: func(t *testing.T, o ScanOptions) {
				if !o.Staged || !o.SetStaged {
					t.Fatalf("staged not set: %+v", o)
				}
			},
		},
		{
			name: "only_csv",
			args: []string{"--only", "code,deps"},
			check: func(t *testing.T, o ScanOptions) {
				if len(o.Only) != 2 || o.Only[0] != "code" || o.Only[1] != "deps" {
					t.Fatalf("only=%v", o.Only)
				}
			},
		},
		{
			name: "skip_deps",
			args: []string{"--skip", "deps"},
			check: func(t *testing.T, o ScanOptions) {
				if len(o.Skip) != 1 || o.Skip[0] != "deps" {
					t.Fatalf("skip=%v", o.Skip)
				}
			},
		},
		{
			name: "paths_multi",
			args: []string{"--paths", "a.go", "b.go", "--format", "json"},
			check: func(t *testing.T, o ScanOptions) {
				if len(o.Paths) != 2 || o.Paths[0] != "a.go" || o.Paths[1] != "b.go" {
					t.Fatalf("paths=%v", o.Paths)
				}
				if o.Format != "json" {
					t.Fatalf("format=%q", o.Format)
				}
			},
		},
		{
			name: "flag_equals_value",
			args: []string{"--format=table", "--deps-cache-ttl=24h", "--deps-timeout=30m"},
			check: func(t *testing.T, o ScanOptions) {
				if o.Format != "table" {
					t.Fatalf("format=%q", o.Format)
				}
				if o.DepsCacheTTL != 24*time.Hour {
					t.Fatalf("ttl=%v", o.DepsCacheTTL)
				}
				if o.DepsTimeout != 30*time.Minute {
					t.Fatalf("timeout=%v", o.DepsTimeout)
				}
			},
		},
		{
			name: "quiet_verbose",
			args: []string{"--quiet", "--verbose"},
			check: func(t *testing.T, o ScanOptions) {
				if !o.Quiet || !o.Verbose {
					t.Fatalf("quiet/verbose: %+v", o)
				}
			},
		},
		{
			name: "deps_flags",
			args: []string{
				"--deps-provider", "osv",
				"--deps-provider-url", "https://example.test",
				"--deps-refresh",
				"--deps-http2", "auto",
				"--deps-scope", "tree",
			},
			check: func(t *testing.T, o ScanOptions) {
				if o.DepsProvider != "osv" || o.DepsProviderURL != "https://example.test" {
					t.Fatalf("provider: %+v", o)
				}
				if !o.DepsRefresh || o.DepsHTTP2 != "auto" || o.DepsScope != "tree" {
					t.Fatalf("deps flags: %+v", o)
				}
			},
		},
		{
			name: "secret_flags",
			args: []string{
				"--secret-rules", "r1.yml", "r2.yml",
				"--secret-default-rules", "on",
				"--secret-default-rules-version", "2026-05-25",
				"--secret-rules-update-url", "http://127.0.0.1/bundle.yml",
				"--secret-rules-refresh",
				"--secret-rules-cache-ttl", "15s",
				"--secret-entropy-threshold", "4.2",
				"--secret-min-length", "12",
				"--secret-min-confidence", "medium",
			},
			check: func(t *testing.T, o ScanOptions) {
				if len(o.SecretRules) != 2 {
					t.Fatalf("rules=%v", o.SecretRules)
				}
				if o.SecretDefaultRules != "on" || o.SecretDefaultRulesVersion != "2026-05-25" {
					t.Fatalf("default rules: %+v", o)
				}
				if o.SecretRulesUpdateURL == "" || !o.SecretRulesRefresh {
					t.Fatalf("update/refresh: %+v", o)
				}
				if o.SecretRulesCacheTTL != 15*time.Second {
					t.Fatalf("ttl=%v", o.SecretRulesCacheTTL)
				}
				if o.SecretEntropyThreshold != 4.2 || o.SecretMinLength != 12 || o.SecretMinConfidence != "medium" {
					t.Fatalf("entropy/min: %+v", o)
				}
			},
		},
		{
			name: "staged_only_deps",
			args: []string{"--staged", "--only", "deps"},
			check: func(t *testing.T, o ScanOptions) {
				if !o.Staged || len(o.Only) != 1 || o.Only[0] != "deps" {
					t.Fatalf("%+v", o)
				}
			},
		},
	}
	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, err := parseScanArgs(tc.args)
			if err != nil {
				t.Fatalf("parseScanArgs: %v", err)
			}
			tc.check(t, got)
		})
	}
}

func TestParseScanArgs_Errors(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name string
		args []string
		want string
	}{
		{"unknown_flag", []string{"--nope"}, "unknown flag"},
		{"bad_aspect", []string{"--only", "network"}, "unknown aspect"},
		{"bad_format", []string{"--format", "yaml"}, "table or json"},
		{"bad_duration", []string{"--deps-cache-ttl", "xx"}, "invalid duration"},
		{"paths_empty", []string{"--paths"}, "requires at least one path"},
		{"unexpected_positional", []string{"file.go"}, "unexpected argument"},
		{"bad_confidence", []string{"--secret-min-confidence", "max"}, "low, medium, or high"},
	}
	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			_, err := parseScanArgs(tc.args)
			if err == nil {
				t.Fatal("expected error")
			}
			if !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("error %q does not contain %q", err.Error(), tc.want)
			}
		})
	}
}

func TestParseMCPArgs(t *testing.T) {
	t.Parallel()
	opts, err := parseMCPArgs([]string{"--cwd", "/tmp/proj", "--transport", "stdio", "--log-level", "debug"})
	if err != nil {
		t.Fatal(err)
	}
	if opts.CWD != "/tmp/proj" || opts.Transport != "stdio" || opts.LogLevel != "debug" {
		t.Fatalf("%+v", opts)
	}
	_, err = parseMCPArgs([]string{"--transport", "http"})
	if err == nil || !strings.Contains(err.Error(), "stdio only") {
		t.Fatalf("expected stdio rejection, got %v", err)
	}
}
