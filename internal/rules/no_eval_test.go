package rules

import (
	"testing"

	"github.com/kadraman/codefence/internal/findings"
)

func TestNoEval_IDAndSeverity(t *testing.T) {
	if noEval.ID != IDNoEval {
		t.Fatalf("id %q", noEval.ID)
	}
	if noEval.Severity != findings.SeverityHigh {
		t.Fatalf("severity %q", noEval.Severity)
	}
}

func TestNoEval_Lines(t *testing.T) {
	cases := []struct {
		line string
		hit  bool
	}{
		{`eval("1+1")`, true},
		{`eval ("x")`, true},
		{"eval\t(", true},
		{`const f = new Function("return 1")`, true},
		{`new  Function (`, true},
		{`evaluate("x")`, false},
		{`xeval("x")`, false},
		{`newFunc()`, false},
		{`Function("x")`, false},
		{`// no call here`, false},
	}
	for _, tc := range cases {
		if got := noEval.Match(tc.line); got != tc.hit {
			t.Fatalf("%q: got %v want %v", tc.line, got, tc.hit)
		}
	}
}
