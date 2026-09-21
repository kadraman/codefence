package rules

import (
	"testing"

	"github.com/kadraman/codefence/internal/findings"
)

func TestNoInsecureHTTP_IDAndSeverity(t *testing.T) {
	if noInsecureHTTP.ID != IDNoInsecureHTTP {
		t.Fatalf("id %q", noInsecureHTTP.ID)
	}
	if noInsecureHTTP.Severity != findings.SeverityMedium {
		t.Fatalf("severity %q", noInsecureHTTP.Severity)
	}
}

func TestNoInsecureHTTP_Lines(t *testing.T) {
	cases := []struct {
		line string
		hit  bool
	}{
		{`url = "http://example.com"`, true},
		{`http://evil.local`, true},
		{`http://localhost and http://evil.example`, true},
		{`http://localhost.evil.example`, true},
		{`http://127.0.0.1.attacker.example`, true},
		{`http://127.0.0.11`, true},
		{`http://localhost`, false},
		{`http://localhost:3000/x`, false},
		{`http://localhost/health`, false},
		{`http://localhost?x=1`, false},
		{`http://localhost#frag`, false},
		{`http://127.0.0.1`, false},
		{`http://127.0.0.1:8080/health`, false},
		{`https://example.com`, false},
		{`see HTTP://example.com`, false},
	}
	for _, tc := range cases {
		if got := noInsecureHTTP.Match(tc.line); got != tc.hit {
			t.Fatalf("%q: got %v want %v", tc.line, got, tc.hit)
		}
	}
}
