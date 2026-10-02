package secret

import (
	"strings"
	"testing"

	"github.com/kadraman/codefence/internal/findings"
)

// Split so this package's own sources do not trip staged secret/entropy scanning.
var highEntropySample = strings.Join([]string{"Q4z8vB2n", "Lp9sTw7x", "Yk3mHc6r", "Jd1f"}, "")

func TestEntropySkipsLockfileNoise(t *testing.T) {
	content := strings.Join([]string{
		"[[package]]",
		`name = "serde"`,
		`version = "1.0.188"`,
		`source = "registry+https://github.com/rust-lang/crates.io-index"`,
		`checksum = "` + strings.Join([]string{
			"670ad68c", "90886c1c", "bcb8bb9e", "ccc68dd8",
			"f16ba07f", "caf7ee3c", "8e7be808", "7b5a5556",
		}, "") + `"`,
		"",
	}, "\n")
	findingsList := FindEntropySecrets("Cargo.lock", strings.Split(content, "\n"), DefaultOptions())
	if len(findingsList) != 0 {
		t.Fatalf("expected no entropy hits, got %+v", findingsList)
	}
}

func TestEntropySkipsIntegrityAndURLValues(t *testing.T) {
	content := strings.Join([]string{
		`resolved = "https://registry.npmjs.org/lodash/-/lodash-4.17.20.tgz"`,
		`integrity = "sha512-` + strings.Join([]string{"abc123DE", "F456ghi7", "89JKLmno", "pqrstuvw", "xyz01234", "56789ABC", "DEF"}, "") + `"`,
		`hash = "sha512-` + strings.Join([]string{"9f86d012", "3456789a", "bcdefABC", "DEF01234", "56789abc", "defABCDE", "F0123456", "789abcd"}, "") + `"`,
		`entropyBlob = "` + highEntropySample + `"`,
		"",
	}, "\n")
	hits := FindEntropySecrets("lock-metadata.toml", strings.Split(content, "\n"), DefaultOptions())
	if len(hits) != 1 || hits[0].RuleID != RuleHighEntropy {
		t.Fatalf("want one entropy hit, got %+v", hits)
	}
	if !strings.Contains(hits[0].Evidence, "entropy=") {
		t.Fatalf("evidence: %q", hits[0].Evidence)
	}
}

func TestEntropyFlagsHighEntropyAssignment(t *testing.T) {
	line := `entropyBlob = "` + highEntropySample + `"`
	hits := FindEntropySecrets("config.toml", []string{line}, DefaultOptions())
	if len(hits) != 1 {
		t.Fatalf("%+v", hits)
	}
}

func TestEntropySkipsBareHTTPS(t *testing.T) {
	line := `mirror = "https://example.com/crates/index-with-mixed-CHARS-0123456789"`
	hits := FindEntropySecrets("config.toml", []string{line}, DefaultOptions())
	if len(hits) != 0 {
		t.Fatalf("%+v", hits)
	}
}

func TestEntropyDoesNotSkipUserinfoOrQuery(t *testing.T) {
	opts := DefaultOptions()
	// Assemble without embedding assignment-like strings in this source file.
	prefixUser := "endpoint" + " = \"" + "https://alice:"
	prefixQuery := "callback" + " = \"" + "https://example.com/cb?sig="
	prefixFrag := "deeplink" + " = \"" + "https://example.com/app#"
	suffix := "@example.com/api\""
	userinfo := prefixUser + highEntropySample + suffix
	query := prefixQuery + highEntropySample + "\""
	fragment := prefixFrag + highEntropySample + "\""
	for _, line := range []string{userinfo, query, fragment} {
		hits := FindEntropySecrets("config.toml", []string{line}, opts)
		if len(hits) == 0 {
			t.Fatalf("expected entropy hit for %q", line)
		}
	}
}

func TestShannonEntropyKnownSample(t *testing.T) {
	e := ShannonEntropy(highEntropySample)
	if e < 4.2 {
		t.Fatalf("sample entropy %.4f below threshold", e)
	}
}

func TestConfidenceFilter(t *testing.T) {
	in := []findings.Finding{
		{RuleID: "a", Kind: findings.KindSecret, Confidence: findings.ConfidenceLow, Message: "a", FilePath: "f", Line: 1, Severity: findings.SeverityMedium},
		{RuleID: "b", Kind: findings.KindSecret, Confidence: findings.ConfidenceHigh, Message: "b", FilePath: "f", Line: 2, Severity: findings.SeverityMedium},
	}
	got := FilterByMinConfidence(in, "medium")
	if len(got) != 1 || got[0].RuleID != "b" {
		t.Fatalf("%+v", got)
	}
}
