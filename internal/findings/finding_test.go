package findings

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestFindingJSONTags(t *testing.T) {
	f := Finding{
		RuleID:         RuleVulnerableDependency,
		Message:        "vulnerable package",
		FilePath:       "go.mod",
		Line:           3,
		Severity:       SeverityHigh,
		Confidence:     ConfidenceMedium,
		Evidence:       "ev",
		Remediation:    "upgrade",
		Kind:           KindDependency,
		DetectionMethod: DetectionRule,
		PackageName:    "example.com/lib",
		PackageVersion: "1.0.0",
		AdvisoryID:     "GHSA-xxxx",
		CVEID:          "CVE-2024-1",
		FixedVersion:   "1.0.1",
	}
	b, err := json.Marshal(f)
	if err != nil {
		t.Fatal(err)
	}
	s := string(b)
	wantKeys := []string{
		`"ruleId"`, `"message"`, `"filePath"`, `"line"`, `"severity"`,
		`"confidence"`, `"evidence"`, `"remediation"`, `"kind"`, `"detectionMethod"`,
		`"packageName"`, `"packageVersion"`, `"advisoryId"`, `"cveId"`, `"fixedVersion"`,
	}
	for _, k := range wantKeys {
		if !strings.Contains(s, k) {
			t.Fatalf("missing key %s in %s", k, s)
		}
	}
	// Must not emit snake_case Finding wire aliases.
	for _, bad := range []string{`"file_path"`, `"package_name"`, `"cve_id"`, `"fixed_version"`} {
		if strings.Contains(s, bad) {
			t.Fatalf("unexpected snake_case key %s in %s", bad, s)
		}
	}
}

func TestMapRuleSeverity(t *testing.T) {
	cases := []struct {
		in   string
		want Severity
		ok   bool
	}{
		{"critical", SeverityCritical, true},
		{"HIGH", SeverityHigh, true},
		{"medium", SeverityMedium, true},
		{"low", SeverityLow, true},
		{"ERROR", SeverityCritical, true},
		{"WARNING", SeverityMedium, true},
		{"INFO", SeverityLow, true},
		{"error", SeverityCritical, true},
		{"nope", "", false},
	}
	for _, tc := range cases {
		got, ok := MapRuleSeverity(tc.in)
		if ok != tc.ok || got != tc.want {
			t.Fatalf("%q: got (%q,%v) want (%q,%v)", tc.in, got, ok, tc.want, tc.ok)
		}
	}
}

func TestEntropySeverity(t *testing.T) {
	const T = 4.2
	cases := []struct {
		entropy float64
		want    Severity
	}{
		{T + 1.0, SeverityCritical},
		{T + 1.5, SeverityCritical},
		{T + 0.6, SeverityHigh},
		{T + 0.9, SeverityHigh},
		{T + 0.5, SeverityMedium},
		{T, SeverityMedium},
	}
	for _, tc := range cases {
		if got := EntropySeverity(tc.entropy, T); got != tc.want {
			t.Fatalf("entropy %v: got %q want %q", tc.entropy, got, tc.want)
		}
	}
}

func TestRuleVulnerableDependencyConstant(t *testing.T) {
	if RuleVulnerableDependency != "vulnerable-dependency" {
		t.Fatalf("got %q", RuleVulnerableDependency)
	}
}
