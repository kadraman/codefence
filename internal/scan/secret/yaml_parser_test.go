package secret

import (
	"testing"
)

func TestParsePatternsAndEither(t *testing.T) {
	yaml := `rules:
  - id: either-demo
    message: either hit
    severity: WARNING
    pattern-either:
      - pattern: LITERAL_SECRET_MARK
      - pattern-regex: "\\bEITHER_[A-Z0-9]{8}\\b"
  - id: nested-patterns
    message: nested
    severity: INFO
    patterns:
      - pattern-regex: "\\bnested_[a-z]{6}\\b"
`
	rules, err := ParseRuleBundle(yaml, "demo.yml", SourceCustom)
	if err != nil {
		t.Fatal(err)
	}
	if len(rules) != 2 {
		t.Fatalf("got %d rules", len(rules))
	}
	if len(rules[0].Patterns) != 2 {
		t.Fatalf("either patterns: %+v", rules[0].Patterns)
	}
	if err := CompileRules(rules); err != nil {
		t.Fatal(err)
	}
	hits := MatchRules("f.js", []string{"const x = LITERAL_SECRET_MARK;"}, rules)
	if len(hits) != 1 || hits[0].RuleID != "either-demo" {
		t.Fatalf("%+v", hits)
	}
}
