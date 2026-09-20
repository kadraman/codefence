package cli

import (
	"os"
	"path/filepath"
	"testing"
)

func TestMain_BadConfigExit2(t *testing.T) {
	dir := t.TempDir()
	bad := []byte("version: 99\nscan:\n  format: table\n")
	if err := os.WriteFile(filepath.Join(dir, "codefence-config.yml"), bad, 0o644); err != nil {
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

	_, stderr, code := withCapture(t, func() int {
		return Main([]string{"scan", "--staged"})
	})
	if code != ExitUsage {
		t.Fatalf("exit %d want %d stderr=%s", code, ExitUsage, stderr)
	}
	if stderr == "" {
		t.Fatal("expected config error on stderr")
	}
}

func TestMain_MergedDefaults(t *testing.T) {
	dir := t.TempDir()
	wd, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chdir(wd) })

	opts, err := parseScanArgs([]string{"--staged"})
	if err != nil {
		t.Fatal(err)
	}
	cfg, err := resolveForTest(opts)
	if err != nil {
		t.Fatal(err)
	}
	applyMergedConfig(&opts, cfg)
	if opts.Format != "table" {
		t.Fatalf("format default: %q", opts.Format)
	}
	if opts.DepsScope != "changed" {
		t.Fatalf("deps scope default: %q", opts.DepsScope)
	}
	if len(opts.Aspects) != 1 || opts.Aspects[0] != "code" {
		t.Fatalf("aspects: %#v", opts.Aspects)
	}
}
