package scan

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

func TestBuildContext_ExplicitPathsBypassIgnore(t *testing.T) {
	dir := t.TempDir()
	ex := filepath.Join(dir, "examples")
	if err := os.Mkdir(ex, 0o755); err != nil {
		t.Fatal(err)
	}
	f := filepath.Join(ex, "a.go")
	if err := os.WriteFile(f, []byte("package main\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	ctx, err := BuildContext(dir, Options{
		Paths:              []string{"examples"},
		GitIgnoredPrefixes: []string{"examples/"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if !ctx.ExplicitPaths {
		t.Fatal("expected explicitPaths")
	}
	if len(ctx.Files) != 1 {
		t.Fatalf("files: %#v", ctx.Files)
	}
}

func TestRunScan_OrderingAndAggregation(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "go.mod"), []byte("module x\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	wd, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chdir(wd) })

	order := []AspectID{}
	reg := Registry{
		AspectCode: func(ctx Context) AspectOutcome {
			order = append(order, AspectCode)
			return AspectOutcome{Aspect: AspectCode, Status: StatusOK}
		},
		AspectDeps: func(ctx Context) AspectOutcome {
			order = append(order, AspectDeps)
			return AspectOutcome{Aspect: AspectDeps, Status: StatusFailed, ExitCode: 1}
		},
	}
	var stdout, stderr bytes.Buffer
	res, err := RunScanWithRegistry(Options{
		Paths:   []string{"go.mod"},
		Aspects: []string{"code"},
		Format:  "json",
		Quiet:   true,
	}, reg, &stdout, &stderr)
	if err != nil {
		t.Fatal(err)
	}
	if len(order) != 2 || order[0] != AspectCode || order[1] != AspectDeps {
		t.Fatalf("order %#v", order)
	}
	if res.ExitCode != 1 {
		t.Fatalf("exit %d", res.ExitCode)
	}
}
