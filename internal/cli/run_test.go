package cli

import (
	"bytes"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"testing"
)

var streamMu sync.Mutex

func withCapture(t *testing.T, fn func() int) (stdout, stderr string, code int) {
	t.Helper()
	streamMu.Lock()
	defer streamMu.Unlock()
	var outBuf, errBuf bytes.Buffer
	oldOut, oldErr := Stdout, Stderr
	Stdout, Stderr = &outBuf, &errBuf
	defer func() {
		Stdout, Stderr = oldOut, oldErr
	}()
	code = fn()
	return outBuf.String(), errBuf.String(), code
}

func TestMain_HelpAndUsage(t *testing.T) {
	cases := []struct {
		name string
		args []string
		code int
		out  string // substring on stdout
		err  string // substring on stderr
	}{
		{"root_help", []string{"--help"}, ExitOK, "Commands:", ""},
		{"root_empty", []string{}, ExitOK, "Commands:", ""},
		{"scan_help", []string{"scan", "--help"}, ExitOK, "Aspects:", ""},
		{"scan_help_env", []string{"scan", "-h"}, ExitOK, "CODEFENCE_ASPECTS", ""},
		{"scan_help_ignored", []string{"scan", "--help"}, ExitOK, "git_ignored_prefixes", ""},
		{"unknown_command", []string{"nope"}, ExitUsage, "", "unknown command"},
		{"unknown_flag", []string{"scan", "--nope"}, ExitUsage, "", "unknown flag"},
		{"pre_commit_help", []string{"pre-commit", "--help"}, ExitOK, "scan --staged", ""},
		{"mcp_help", []string{"mcp", "--help"}, ExitOK, "stdio", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			stdout, stderr, code := withCapture(t, func() int { return Main(tc.args) })
			if code != tc.code {
				t.Fatalf("exit %d want %d\nstdout=%s\nstderr=%s", code, tc.code, stdout, stderr)
			}
			if tc.out != "" && !strings.Contains(stdout, tc.out) {
				t.Fatalf("stdout missing %q:\n%s", tc.out, stdout)
			}
			if tc.err != "" && !strings.Contains(stderr, tc.err) {
				t.Fatalf("stderr missing %q:\n%s", tc.err, stderr)
			}
		})
	}
}

func TestMain_ScanDispatchAndPreCommit(t *testing.T) {
	_, _, code := withCapture(t, func() int {
		return Main([]string{"scan", "--staged", "--only", "deps"})
	})
	if code != ExitOK {
		t.Fatalf("scan exit %d", code)
	}
	_, _, code = withCapture(t, func() int {
		return Main([]string{"pre-commit"})
	})
	if code != ExitOK {
		t.Fatalf("pre-commit exit %d", code)
	}
}

func TestMain_VersionCheckDepsMCPInstall(t *testing.T) {
	stdout, _, code := withCapture(t, func() int { return Main([]string{"version"}) })
	if code != ExitOK {
		t.Fatalf("version exit %d", code)
	}
	if !strings.Contains(stdout, "codefence") {
		t.Fatalf("version output: %q", stdout)
	}

	stdout, _, code = withCapture(t, func() int { return Main([]string{"check-deps"}) })
	if code != ExitOK {
		t.Fatalf("check-deps exit %d", code)
	}
	if !strings.Contains(stdout, "codefence scan") {
		t.Fatalf("redirect missing: %q", stdout)
	}

	_, stderr, code := withCapture(t, func() int {
		return Main([]string{"mcp", "--transport", "sse"})
	})
	if code != ExitUsage || !strings.Contains(stderr, "stdio") {
		t.Fatalf("mcp reject: code=%d stderr=%s", code, stderr)
	}

	_, _, code = withCapture(t, func() int {
		return Main([]string{"mcp", "--cwd", ".", "--transport", "stdio", "--log-level", "warn"})
	})
	if code != ExitOK {
		t.Fatalf("mcp ok exit %d", code)
	}

	stdout, _, code = withCapture(t, func() int {
		return Main([]string{"install", "--dry-run"})
	})
	if code != ExitOK || !strings.Contains(stdout, "dry-run") {
		t.Fatalf("install: code=%d out=%s", code, stdout)
	}

	stdout, _, code = withCapture(t, func() int {
		return Main([]string{"install-hooks", "--dry-run"})
	})
	if code != ExitOK || !strings.Contains(stdout, "dry-run") {
		t.Fatalf("install-hooks: code=%d out=%s", code, stdout)
	}

	_, _, code = withCapture(t, func() int {
		return Main([]string{"background-scan", "--file", "x.go"})
	})
	if code != ExitOK {
		t.Fatalf("background-scan exit %d", code)
	}

	_, _, code = withCapture(t, func() int {
		return Main([]string{"scan-worker", "--file", "x.go"})
	})
	if code != ExitOK {
		t.Fatalf("scan-worker exit %d", code)
	}
}

func TestHelpGoldens(t *testing.T) {
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	repoRoot := filepath.Clean(filepath.Join(filepath.Dir(thisFile), "..", ".."))
	goldenDir := filepath.Join(repoRoot, "testdata", "cli")

	cases := []struct {
		name   string
		args   []string
		golden string
	}{
		{"root", []string{"--help"}, "help-root.txt"},
		{"scan", []string{"scan", "--help"}, "help-scan.txt"},
		{"mcp", []string{"mcp", "--help"}, "help-mcp.txt"},
		{"version", []string{"version", "--help"}, "help-version.txt"},
	}

	// Match version command output only (e.g. "codefence 1.0.0 (abc123)"), not help titles.
	versionLine := regexp.MustCompile(`(?m)^codefence \S+ \(\S+\)\n`)

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			stdout, _, code := withCapture(t, func() int { return Main(tc.args) })
			if code != ExitOK {
				t.Fatalf("exit %d", code)
			}
			got := versionLine.ReplaceAllString(stdout, "codefence VERSION (COMMIT)")
			path := filepath.Join(goldenDir, tc.golden)
			wantBytes, err := os.ReadFile(path)
			if err != nil {
				if os.Getenv("UPDATE_CLI_GOLDEN") == "1" {
					if mkErr := os.MkdirAll(goldenDir, 0o755); mkErr != nil {
						t.Fatal(mkErr)
					}
					if wErr := os.WriteFile(path, []byte(got), 0o644); wErr != nil {
						t.Fatal(wErr)
					}
					t.Logf("wrote golden %s", path)
					return
				}
				t.Fatalf("read golden: %v (set UPDATE_CLI_GOLDEN=1 to create)", err)
			}
			want := string(wantBytes)
			// Normalize newlines for Windows checkouts.
			want = strings.ReplaceAll(want, "\r\n", "\n")
			got = strings.ReplaceAll(got, "\r\n", "\n")
			if got != want {
				if os.Getenv("UPDATE_CLI_GOLDEN") == "1" {
					if wErr := os.WriteFile(path, []byte(got), 0o644); wErr != nil {
						t.Fatal(wErr)
					}
					t.Logf("updated golden %s", path)
					return
				}
				t.Fatalf("golden mismatch for %s\n--- got ---\n%s\n--- want ---\n%s", tc.golden, got, want)
			}
		})
	}
}
