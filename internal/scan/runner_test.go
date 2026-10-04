package scan

import (
	"bytes"
	"errors"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/kadraman/codefence/internal/findings"
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
	res, err := RunScanWithRegistry(dir, Options{
		Paths:   []string{"go.mod"},
		Aspects: []string{"code"},
		Format:  "json",
		Quiet:   true,
	}, reg, &stdout, &stderr)
	if err != nil {
		t.Fatal(err)
	}
	if res.CWD != dir {
		t.Fatalf("CWD = %q want %q", res.CWD, dir)
	}
	if len(order) != 2 || order[0] != AspectCode || order[1] != AspectDeps {
		t.Fatalf("order %#v", order)
	}
	if res.ExitCode != 1 {
		t.Fatalf("exit %d", res.ExitCode)
	}
}

func TestRunScan_WarningsGoToStderrOnly(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "a.go"), []byte("package main\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	reg := Registry{
		AspectCode: func(ctx Context) AspectOutcome {
			return AspectOutcome{Aspect: AspectCode, Status: StatusOK, Warnings: []string{"rules fell back"}}
		},
	}
	for _, format := range []string{"json", "table"} {
		var stdout, stderr bytes.Buffer
		if _, err := RunScanWithRegistry(dir, Options{
			Paths:  []string{"a.go"},
			Only:   []string{"code"},
			Format: format,
			Quiet:  true,
		}, reg, &stdout, &stderr); err != nil {
			t.Fatal(err)
		}
		if !bytes.Contains(stderr.Bytes(), []byte("warning[code]: rules fell back\n")) {
			t.Fatalf("%s: stderr missing warning: %q", format, stderr.String())
		}
		if bytes.Contains(stdout.Bytes(), []byte("rules fell back")) {
			t.Fatalf("%s: warning leaked to stdout: %q", format, stdout.String())
		}
	}
}

type errWriter struct{ err error }

func (w errWriter) Write([]byte) (int, error) { return 0, w.err }

func TestRunScan_PropagatesWriteTableError(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "a.go"), []byte("package main\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	want := io.ErrClosedPipe
	reg := Registry{
		AspectCode: func(ctx Context) AspectOutcome {
			return AspectOutcome{
				Aspect: AspectCode, Status: StatusOK,
				Findings: []findings.Finding{{
					RuleID: "no-eval", Message: "m", FilePath: "a.go", Line: 1,
					Severity: findings.SeverityHigh, Kind: findings.KindCode,
				}},
			}
		},
	}
	res, err := RunScanWithRegistry(dir, Options{
		Paths:  []string{"a.go"},
		Only:   []string{"code"},
		Format: "json",
		Quiet:  true,
	}, reg, errWriter{err: want}, io.Discard)
	if err == nil {
		t.Fatal("expected write error")
	}
	if !errors.Is(err, want) {
		t.Fatalf("got %v want %v", err, want)
	}
	if res.ExitCode == 0 {
		t.Fatalf("exit code should be non-zero on output failure, got %d", res.ExitCode)
	}
}

func TestRunScan_UsesExplicitCWDWithoutChdir(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "a.go"), []byte("package main\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	wd, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	var saw string
	reg := Registry{
		AspectCode: func(ctx Context) AspectOutcome {
			saw = ctx.CWD
			return AspectOutcome{Aspect: AspectCode, Status: StatusSkipped, Message: "no files in scope"}
		},
	}
	res, err := RunScanWithRegistry(dir, Options{
		Paths:  []string{"a.go"},
		Only:   []string{"code"},
		Format: "json",
		Quiet:  true,
	}, reg, io.Discard, io.Discard)
	if err != nil {
		t.Fatal(err)
	}
	if saw != dir {
		t.Fatalf("ctx.CWD = %q want %q", saw, dir)
	}
	if res.CWD != dir {
		t.Fatalf("result.CWD = %q want %q", res.CWD, dir)
	}
	gotWD, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if gotWD != wd {
		t.Fatalf("process cwd changed from %q to %q", wd, gotWD)
	}
}

func TestRunScan_SecureCodingFixturesFailCodeAspect(t *testing.T) {
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	root := filepath.Clean(filepath.Join(filepath.Dir(thisFile), "..", "..", "testdata", "code"))
	res, err := RunScan(root, Options{
		Paths:  []string{"positive/eval.js"},
		Only:   []string{"code"},
		Format: "json",
		Quiet:  true,
	}, io.Discard, io.Discard)
	if err != nil {
		t.Fatal(err)
	}
	if res.ExitCode != 1 {
		t.Fatalf("exit %d outcomes %+v", res.ExitCode, res.Outcomes)
	}
	if len(res.Outcomes) != 1 || res.Outcomes[0].Aspect != AspectCode || res.Outcomes[0].Status != StatusFailed {
		t.Fatalf("outcomes %+v", res.Outcomes)
	}
	found := false
	for _, f := range res.Outcomes[0].Findings {
		if f.RuleID == "no-eval" && f.Kind == findings.KindCode {
			found = true
		}
	}
	if !found {
		t.Fatalf("missing no-eval in %+v", res.Outcomes[0].Findings)
	}

	okRes, err := RunScan(root, Options{
		Paths:  []string{"negative/safe.js"},
		Only:   []string{"code"},
		Format: "json",
		Quiet:  true,
	}, io.Discard, io.Discard)
	if err != nil {
		t.Fatal(err)
	}
	if okRes.ExitCode != 0 {
		t.Fatalf("safe.js exit %d outcomes %+v", okRes.ExitCode, okRes.Outcomes)
	}
}
