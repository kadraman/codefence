package output

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kadraman/codefence/internal/findings"
)

func TestMapFinding_CodeSecretDeps(t *testing.T) {
	code := findings.Finding{
		RuleID: "no-eval", Message: "eval", FilePath: "a.js", Line: 2,
		Severity: findings.SeverityHigh, Kind: findings.KindCode,
	}
	w := MapFinding(code, "code")
	if w.Category != "code" || w.Filename != "a.js" || w.Location == nil || w.Location.Line != 2 {
		t.Fatalf("code wire: %+v", w)
	}
	if w.Fixed != nil || w.Package != nil {
		t.Fatalf("code should null package/fixed: %+v", w)
	}

	secret := findings.Finding{
		RuleID: "secret-token", Message: "token", FilePath: "b.env", Line: 1,
		Severity: findings.SeverityCritical, Kind: findings.KindSecret,
		Confidence: findings.ConfidenceHigh, DetectionMethod: findings.DetectionEntropy,
	}
	ws := MapFinding(secret, "code")
	if ws.Category != "code" {
		t.Fatalf("secret category want code got %q", ws.Category)
	}
	if ws.Kind == nil || *ws.Kind != "secret" {
		t.Fatalf("secret kind: %+v", ws.Kind)
	}

	deps := findings.Finding{
		RuleID: findings.RuleVulnerableDependency, Message: "vuln", FilePath: "go.mod", Line: 0,
		Severity: findings.SeverityMedium, Kind: findings.KindDependency,
		PackageName: "lib", PackageVersion: "1.0.0", CVEID: "CVE-1", FixedVersion: "1.2.0",
	}
	wd := MapFinding(deps, "deps")
	if wd.Category != "dependency" {
		t.Fatalf("deps category: %q", wd.Category)
	}
	if wd.Fixed == nil || *wd.Fixed != ">= 1.2.0" {
		t.Fatalf("fixed: %+v", wd.Fixed)
	}
	if wd.Location != nil {
		t.Fatalf("line 0 => location null, got %+v", wd.Location)
	}
	if wd.CVE == nil || *wd.CVE != "CVE-1" {
		t.Fatalf("cve: %+v", wd.CVE)
	}
}

func TestShowProgressMatrix(t *testing.T) {
	cases := []struct {
		opts Options
		want bool
	}{
		{Options{Format: FormatTable}, true},
		{Options{Format: FormatTable, Quiet: true}, false},
		{Options{Format: FormatJSON}, false},
		{Options{Format: FormatJSON, Verbose: true}, true},
		{Options{Format: FormatJSON, Verbose: true, Quiet: true}, false},
	}
	for _, tc := range cases {
		if got := ShowProgress(tc.opts); got != tc.want {
			t.Fatalf("%+v: got %v want %v", tc.opts, got, tc.want)
		}
	}
}

func TestJSONNoProgressOnStdout(t *testing.T) {
	var stdout, stderr bytes.Buffer
	w := NewWriter(Options{Format: FormatJSON, Verbose: true}, &stdout, &stderr)
	w.Progress("running")
	if stdout.Len() != 0 {
		t.Fatalf("progress leaked to stdout: %q", stdout.String())
	}
	if !strings.Contains(stderr.String(), "running") {
		t.Fatalf("progress missing on stderr: %q", stderr.String())
	}
	f := findings.Finding{
		RuleID: "no-eval", Message: "m", FilePath: "a.go", Line: 1,
		Severity: findings.SeverityLow, Kind: findings.KindCode,
	}
	if err := w.WriteFinding(f, "code"); err != nil {
		t.Fatal(err)
	}
	if stderr.Len() == 0 && !strings.Contains(stdout.String(), `"filename"`) {
		t.Fatalf("finding not on stdout: out=%q err=%q", stdout.String(), stderr.String())
	}
	var wire WireFinding
	if err := json.Unmarshal(stdout.Bytes(), &wire); err != nil {
		t.Fatalf("ndjson: %v (%s)", err, stdout.String())
	}
	if wire.Filename == "" || strings.Contains(stdout.String(), `"filePath"`) {
		t.Fatalf("wire keys wrong: %s", stdout.String())
	}
}

func TestGoldenNDJSON(t *testing.T) {
	f := findings.Finding{
		RuleID: findings.RuleVulnerableDependency, Message: "vulnerable",
		FilePath: "package-lock.json", Line: 10, Severity: findings.SeverityHigh,
		Kind: findings.KindDependency, PackageName: "left-pad", PackageVersion: "1.0.0",
		CVEID: "CVE-2019-1", FixedVersion: "1.0.1", AdvisoryID: "GHSA-1",
	}
	wire := MapFinding(f, "deps")
	got, err := json.Marshal(wire)
	if err != nil {
		t.Fatal(err)
	}
	goldenPath := filepath.Join("..", "..", "testdata", "output", "deps-finding.ndjson")
	want, err := os.ReadFile(goldenPath)
	if err != nil {
		t.Fatalf("read golden: %v", err)
	}
	var gotObj, wantObj map[string]any
	if err := json.Unmarshal(got, &gotObj); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(want, &wantObj); err != nil {
		t.Fatal(err)
	}
	for _, k := range []string{"category", "severity", "package", "version", "fixed", "cve", "filename", "location", "ruleId", "advisoryId", "message"} {
		if _, ok := wantObj[k]; !ok {
			t.Fatalf("golden missing %s", k)
		}
		if fmt := stringify(gotObj[k]); fmt != stringify(wantObj[k]) {
			t.Fatalf("key %s: got %v want %v", k, gotObj[k], wantObj[k])
		}
	}
	for _, bad := range []string{"filePath", "packageName", "packageVersion", "fixedVersion", "cveId"} {
		if _, ok := gotObj[bad]; ok {
			t.Fatalf("Finding tag leaked: %s", bad)
		}
	}
}

func TestWarningWire(t *testing.T) {
	w := NewWarning("deps", "lockfile-missing", "lock missing", "package.json", "add lockfile")
	b, _ := json.Marshal(w)
	s := string(b)
	if !strings.Contains(s, `"category":"warning"`) || !strings.Contains(s, `"aspect":"deps"`) {
		t.Fatalf("%s", s)
	}
}

func stringify(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}
