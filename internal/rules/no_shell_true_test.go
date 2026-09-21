package rules

import (
	"testing"

	"github.com/kadraman/codefence/internal/findings"
)

func TestNoShellTrue_IDAndSeverity(t *testing.T) {
	if noShellTrue.ID != IDNoShellTrue {
		t.Fatalf("id %q", noShellTrue.ID)
	}
	if noShellTrue.Severity != findings.SeverityMedium {
		t.Fatalf("severity %q", noShellTrue.Severity)
	}
}

func TestNoShellTrue_Lines(t *testing.T) {
	cases := []struct {
		line string
		hit  bool
	}{
		{`spawn("sh", { shell: true })`, true},
		{`shell:true`, true},
		{`shell :  true`, true},
		{`shell: false`, false},
		{`true: shell`, false},
		{`"shell": true`, false}, // spec regex has no optional quotes
	}
	for _, tc := range cases {
		if got := noShellTrue.Match(tc.line); got != tc.hit {
			t.Fatalf("%q: got %v want %v", tc.line, got, tc.hit)
		}
	}
}
