package secret

import (
	"strings"
	"testing"

	"github.com/kadraman/codefence/internal/findings"
)

func TestMergeRuleAndEntropy(t *testing.T) {
	ClearProcessCache()
	t.Cleanup(ClearProcessCache)

	// Built via join so this test file does not contain a scannable secret assignment.
	token := strings.Join([]string{"Q4z8vB2n", "Lp9sTw7x", "Yk3mHc6r", "Jd1f", "abcdefghij"}, "")
	content := strings.Join([]string{`const apiKey = "`, token, `";`, "\n"}, "")
	rules, err := LoadRules("", Options{DefaultRules: "on"})
	if err != nil {
		t.Fatal(err)
	}
	got, err := ScanContent("sample.ts", content, DefaultOptions(), rules)
	if err != nil {
		t.Fatal(err)
	}
	var combined *findings.Finding
	for i := range got {
		if got[i].RuleID == "no-hardcoded-secret" {
			combined = &got[i]
			break
		}
	}
	if combined == nil {
		t.Fatalf("missing no-hardcoded-secret in %+v", got)
	}
	if combined.DetectionMethod != findings.DetectionRuleEntropy {
		t.Fatalf("detectionMethod=%q", combined.DetectionMethod)
	}
	if !strings.Contains(combined.Evidence, "entropy=") {
		t.Fatalf("evidence missing entropy: %q", combined.Evidence)
	}
	if !strings.Contains(combined.Evidence, "matched secret pattern") {
		t.Fatalf("evidence missing rule match: %q", combined.Evidence)
	}
	for _, f := range got {
		if f.RuleID == RuleHighEntropy {
			t.Fatalf("standalone entropy should be merged away: %+v", got)
		}
	}
}

func TestMergeKeepsStandaloneEntropy(t *testing.T) {
	ClearProcessCache()
	t.Cleanup(ClearProcessCache)

	token := strings.Join([]string{"Q4z8vB2n", "Lp9sTw7x", "Yk3mHc6r", "Jd1f"}, "")
	content := strings.Join([]string{`const entropyBlob = "`, token, `";`, "\n"}, "")
	rules, err := LoadRules("", Options{DefaultRules: "on"})
	if err != nil {
		t.Fatal(err)
	}
	got, err := ScanContent("sample.ts", content, DefaultOptions(), rules)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].RuleID != RuleHighEntropy {
		t.Fatalf("%+v", got)
	}
	if got[0].DetectionMethod != findings.DetectionEntropy {
		t.Fatalf("detectionMethod=%q", got[0].DetectionMethod)
	}
}

func TestTruncateEvidence(t *testing.T) {
	long := strings.Repeat("x", 200)
	got := TruncateEvidence(long, 50)
	if len(got) != 50 || !strings.HasSuffix(got, "...") {
		t.Fatalf("%q len=%d", got, len(got))
	}
}
