package scan

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestDefaultRegistry_FailsClosedWhenWorkInScope(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "main.go")
	if err := os.WriteFile(src, []byte("package main\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	mod := filepath.Join(dir, "go.mod")
	if err := os.WriteFile(mod, []byte("module example\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	reg := DefaultRegistry()
	code := reg[AspectCode](Context{Files: []string{"main.go"}, Options: Options{}})
	if code.Status != StatusFailed || code.ExitCode != 1 {
		t.Fatalf("code: %+v", code)
	}
	if !strings.Contains(code.Message, "not implemented") {
		t.Fatalf("code message: %q", code.Message)
	}

	deps := reg[AspectDeps](Context{Files: []string{"go.mod"}, Options: Options{}})
	if deps.Status != StatusFailed || deps.ExitCode != 1 {
		t.Fatalf("deps: %+v", deps)
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
