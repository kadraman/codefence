package code

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/kadraman/codefence/internal/findings"
	"github.com/kadraman/codefence/internal/rules"
)

func testdataCode(t *testing.T) string {
	t.Helper()
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	return filepath.Clean(filepath.Join(filepath.Dir(thisFile), "..", "..", "..", "testdata", "code"))
}

func TestScanFiles_PositiveFixtures(t *testing.T) {
	root := testdataCode(t)
	files := []string{
		"positive/eval.js",
		"positive/new-function.ts",
		"positive/shell.js",
		"positive/http.py",
		"positive/http-lookalike.js",
		"positive/multi.js",
	}
	got, err := ScanFiles(root, files)
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]string{
		"positive/eval.js":           rules.IDNoEval,
		"positive/new-function.ts":   rules.IDNoEval,
		"positive/shell.js":          rules.IDNoShellTrue,
		"positive/http.py":           rules.IDNoInsecureHTTP,
		"positive/http-lookalike.js": rules.IDNoInsecureHTTP,
	}
	seen := map[string][]string{}
	for _, f := range got {
		if f.Kind != findings.KindCode {
			t.Fatalf("kind %q", f.Kind)
		}
		if f.Line < 1 {
			t.Fatalf("line %d for %+v", f.Line, f)
		}
		seen[f.FilePath] = append(seen[f.FilePath], f.RuleID)
	}
	for path, id := range want {
		if !containsID(seen[path], id) {
			t.Fatalf("%s: missing %s in %v (all %+v)", path, id, seen[path], got)
		}
	}
	multi := seen["positive/multi.js"]
	if !containsID(multi, rules.IDNoEval) || !containsID(multi, rules.IDNoInsecureHTTP) {
		t.Fatalf("multi.js rules %v", multi)
	}
}

func TestScanFiles_NegativeAndIgnored(t *testing.T) {
	root := testdataCode(t)
	files := []string{
		"negative/safe.js",
		"negative/localhost.yaml",
		"ignored/readme.md",
		"ignored/node_modules/pkg/index.js",
	}
	got, err := ScanFiles(root, files)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 0 {
		t.Fatalf("unexpected findings %+v", got)
	}
}

func TestScanFiles_BinarySkipped(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "blob.js")
	if err := os.WriteFile(p, []byte("eval('x')\x00more"), 0o644); err != nil {
		t.Fatal(err)
	}
	got, err := ScanFiles(dir, []string{"blob.js"})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 0 {
		t.Fatalf("binary should be skipped: %+v", got)
	}
}

func TestScanFiles_MissingFileFails(t *testing.T) {
	_, err := ScanFiles(t.TempDir(), []string{"missing.go"})
	if err == nil {
		t.Fatal("expected read error")
	}
}

func TestScanFiles_FailsOnEvalFinding(t *testing.T) {
	// Aspect fail-on-finding is wired in internal/scan; here we assert findings are produced.
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "a.js"), []byte("eval(1)\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	got, err := ScanFiles(dir, []string{"a.js"})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].RuleID != rules.IDNoEval || got[0].Severity != findings.SeverityHigh {
		t.Fatalf("%+v", got)
	}
}

func TestScan_WindowedRuleAPI(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "a.js"), []byte("foo\nbar\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	r := rules.MustCompile("window-demo", findings.SeverityLow, "window", 2, "foo\nbar")
	got, err := scanWithRules(dir, []string{"a.js"}, []rules.Rule{r})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].Line != 1 || got[0].RuleID != "window-demo" {
		t.Fatalf("%+v", got)
	}
}

func containsID(ids []string, want string) bool {
	for _, id := range ids {
		if id == want {
			return true
		}
	}
	return false
}
