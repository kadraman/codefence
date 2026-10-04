package secret

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/kadraman/codefence/internal/findings"
)

func testdataSecrets(t *testing.T) string {
	t.Helper()
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	return filepath.Clean(filepath.Join(filepath.Dir(thisFile), "..", "..", "..", "testdata", "secrets"))
}

func TestBuiltinEmbedMatchesRulesPath(t *testing.T) {
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	repoRoot := filepath.Clean(filepath.Join(filepath.Dir(thisFile), "..", "..", ".."))
	disk, err := os.ReadFile(filepath.Join(repoRoot, "rules", "secret", "builtin.yml"))
	if err != nil {
		t.Fatal(err)
	}
	if string(disk) != string(BuiltinYAML()) {
		t.Fatal("embedded builtin.yml diverges from rules/secret/builtin.yml")
	}
	if !strings.Contains(string(disk), BuiltinRulesVersion) {
		t.Fatalf("missing version %s in builtin pack", BuiltinRulesVersion)
	}
}

func TestParseAndMatchBuiltinFixtures(t *testing.T) {
	ClearProcessCache()
	t.Cleanup(ClearProcessCache)

	rules, err := LoadRules("", Options{DefaultRules: "on"})
	if err != nil {
		t.Fatal(err)
	}
	ids := map[string]bool{}
	for _, r := range rules {
		ids[r.ID] = true
	}
	for _, id := range []string{
		"secret-github-token", "secret-gitlab-token", "secret-stripe-key",
		"secret-bearer-token", "secret-private-key", "secret-password-assignment",
		"secret-uri-credentials", "no-hardcoded-secret",
	} {
		if !ids[id] {
			t.Fatalf("missing builtin rule %s", id)
		}
	}

	root := testdataSecrets(t)
	files := []string{
		"positive/github.env",
		"positive/gitlab.env",
		"positive/stripe.env",
		"positive/password.js",
		"positive/uri.conf",
		"positive/private-key.conf",
		"positive/bearer.env",
	}
	got, err := ScanFiles(root, files, Options{DefaultRules: "on", MinConfidence: "low"})
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]string{
		"positive/github.env":      "secret-github-token",
		"positive/gitlab.env":      "secret-gitlab-token",
		"positive/stripe.env":      "secret-stripe-key",
		"positive/password.js":     "secret-password-assignment",
		"positive/uri.conf":        "secret-uri-credentials",
		"positive/private-key.conf": "secret-private-key",
		"positive/bearer.env":      "secret-bearer-token",
	}
	seen := map[string][]string{}
	for _, f := range got {
		if f.Kind != findings.KindSecret {
			t.Fatalf("kind %q", f.Kind)
		}
		seen[f.FilePath] = append(seen[f.FilePath], f.RuleID)
		for _, prefix := range []string{"ghp_", "glpat-", "sk_test_"} {
			if strings.Contains(f.Evidence, prefix) {
				t.Fatalf("evidence leaked secret: %q", f.Evidence)
			}
		}
	}
	for path, id := range want {
		found := false
		for _, gotID := range seen[path] {
			if gotID == id {
				found = true
				break
			}
		}
		if !found {
			t.Fatalf("%s: missing %s in %v (all %+v)", path, id, seen[path], got)
		}
	}
}

func TestParseRuleBundle_ActionableYAMLError(t *testing.T) {
	_, err := ParseRuleBundle("rules: [\n  - id: x\n    message: :\n", "bad.yml", SourceCustom)
	if err == nil {
		t.Fatal("expected YAML error")
	}
	if !strings.Contains(err.Error(), "bad.yml") {
		t.Fatalf("error should name source: %v", err)
	}
}

func TestParseRuleBundle_InvalidRegex(t *testing.T) {
	yaml := `rules:
  - id: bad-re
    message: bad
    pattern-regex: "(unclosed"
`
	_, err := ParseRuleBundle(yaml, "re.yml", SourceCustom)
	if err == nil {
		t.Fatal("expected regex error")
	}
	if !strings.Contains(err.Error(), "bad-re") {
		t.Fatalf("error should name rule: %v", err)
	}
}

func TestSupportedYAMLDocExists(t *testing.T) {
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	path := filepath.Join(filepath.Dir(thisFile), "SUPPORTED_YAML.md")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	for _, field := range []string{"pattern-regex", "pattern", "patterns", "pattern-either"} {
		if !strings.Contains(string(data), field) {
			t.Fatalf("SUPPORTED_YAML.md missing %s", field)
		}
	}
}

func TestDefaultRulesOff(t *testing.T) {
	ClearProcessCache()
	t.Cleanup(ClearProcessCache)
	rules, err := LoadRules("", Options{DefaultRules: "off"})
	if err != nil {
		t.Fatal(err)
	}
	if len(rules) != 0 {
		t.Fatalf("expected no rules, got %d", len(rules))
	}
}

func TestLazyLoad_ProcessCache(t *testing.T) {
	ClearProcessCache()
	t.Cleanup(ClearProcessCache)
	opts := Options{DefaultRules: "on"}
	first, err := LoadRulesCached("", opts)
	if err != nil {
		t.Fatal(err)
	}
	second, err := LoadRulesCached("", opts)
	if err != nil {
		t.Fatal(err)
	}
	if len(first) == 0 || len(second) != len(first) {
		t.Fatalf("cache mismatch %d vs %d", len(first), len(second))
	}
	// Same underlying compiled regex pointers after cache hit.
	if first[0].Patterns[0].compiled != second[0].Patterns[0].compiled {
		t.Fatal("expected process cache to reuse compiled regexes")
	}
}
