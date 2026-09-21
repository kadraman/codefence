// Package rules implements built-in secure-coding line rules (feature 006).
package rules

import (
	"regexp"
	"strings"

	"github.com/kadraman/codefence/internal/findings"
)

// Stable built-in rule IDs (constitution § III).
const (
	IDNoEval         = "no-eval"
	IDNoShellTrue    = "no-shell-true"
	IDNoInsecureHTTP = "no-insecure-http"
)

// Rule is a compiled secure-coding matcher.
// WindowSize 0 or 1 is line-oriented; values > 1 reserve a sliding window of that many lines.
type Rule struct {
	ID         string
	Severity   findings.Severity
	Message    string
	WindowSize int
	re         *regexp.Regexp
	// skipIfFollowedBy implements "http:// not followed by …" without RE2-unsupported lookaheads.
	skipIfFollowedBy []string
}

// MustCompile builds a rule. Panics if expr is not a valid regexp (init-time use).
func MustCompile(id string, severity findings.Severity, message string, windowSize int, expr string) Rule {
	return Rule{
		ID:         id,
		Severity:   severity,
		Message:    message,
		WindowSize: windowSize,
		re:         regexp.MustCompile(expr),
	}
}

// Match reports whether text (one line, or a joined window) hits the rule.
func (r Rule) Match(text string) bool {
	if r.re == nil {
		return false
	}
	if len(r.skipIfFollowedBy) == 0 {
		return r.re.MatchString(text)
	}
	locs := r.re.FindAllStringIndex(text, -1)
	for _, loc := range locs {
		rest := text[loc[1]:]
		skip := false
		for _, prefix := range r.skipIfFollowedBy {
			if strings.HasPrefix(rest, prefix) {
				skip = true
				break
			}
		}
		if !skip {
			return true
		}
	}
	return false
}

// LineWindow returns the number of consecutive lines to join for matching.
// Reserved window API: 0 and 1 both mean a single line.
func (r Rule) LineWindow() int {
	if r.WindowSize < 1 {
		return 1
	}
	return r.WindowSize
}

// Builtin returns the three v1 secure-coding rules in stable ID order.
func Builtin() []Rule {
	return []Rule{noEval, noShellTrue, noInsecureHTTP}
}
