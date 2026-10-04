package scan

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kadraman/codefence/internal/findings"
	"github.com/kadraman/codefence/internal/rules"
)

func TestDefaultRegistry_CodeSecureCoding(t *testing.T) {
	dir := t.TempDir()
	clean := filepath.Join(dir, "main.go")
	if err := os.WriteFile(clean, []byte("package main\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	bad := filepath.Join(dir, "evil.js")
	if err := os.WriteFile(bad, []byte("ev"+"al(1)\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	reg := DefaultRegistry()
	ok := reg[AspectCode](Context{CWD: dir, Files: []string{"main.go"}, Options: Options{}})
	if ok.Status != StatusOK || ok.ExitCode != 0 {
		t.Fatalf("clean: %+v", ok)
	}

	failed := reg[AspectCode](Context{CWD: dir, Files: []string{"evil.js"}, Options: Options{}})
	if failed.Status != StatusFailed || failed.ExitCode != 1 {
		t.Fatalf("evil: %+v", failed)
	}
	if len(failed.Findings) != 1 || failed.Findings[0].RuleID != rules.IDNoEval {
		t.Fatalf("findings: %+v", failed.Findings)
	}
	if failed.Findings[0].Kind != findings.KindCode || failed.Findings[0].Severity != findings.SeverityHigh {
		t.Fatalf("finding fields: %+v", failed.Findings[0])
	}
}

func TestDefaultRegistry_DepsFailsClosedWhenWorkInScope(t *testing.T) {
	dir := t.TempDir()
	mod := filepath.Join(dir, "go.mod")
	if err := os.WriteFile(mod, []byte("module example\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	reg := DefaultRegistry()
	deps := reg[AspectDeps](Context{CWD: dir, Files: []string{"go.mod"}, Options: Options{}})
	if deps.Status != StatusFailed || deps.ExitCode != 1 {
		t.Fatalf("deps: %+v", deps)
	}
	if !strings.Contains(deps.Message, "not implemented") {
		t.Fatalf("deps message: %q", deps.Message)
	}
}

func TestDefaultRegistry_SkipsEmptyScope(t *testing.T) {
	reg := DefaultRegistry()
	code := reg[AspectCode](Context{Files: nil, Options: Options{}})
	if code.Status != StatusSkipped || code.ExitCode != 0 {
		t.Fatalf("code empty: %+v", code)
	}
	deps := reg[AspectDeps](Context{Files: []string{"readme.md"}, Options: Options{}})
	if deps.Status != StatusSkipped || deps.ExitCode != 0 {
		t.Fatalf("deps empty: %+v", deps)
	}
}
