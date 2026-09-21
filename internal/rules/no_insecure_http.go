package rules

import (
	"regexp"
	"strings"

	"github.com/kadraman/codefence/internal/findings"
)

var httpSchemeRe = regexp.MustCompile(`http://`)

var noInsecureHTTP = Rule{
	ID:       IDNoInsecureHTTP,
	Severity: findings.SeverityMedium,
	Message:  "Prefer HTTPS",
	match:    matchNoInsecureHTTP,
}

func matchNoInsecureHTTP(text string) bool {
	locs := httpSchemeRe.FindAllStringIndex(text, -1)
	for _, loc := range locs {
		if !isExemptLoopbackHost(text[loc[1]:]) {
			return true
		}
	}
	return false
}

// isExemptLoopbackHost reports whether rest (the bytes after "http://") is host
// localhost or 127.0.0.1. The host must end at end-of-string or at :, /, ?, or #.
func isExemptLoopbackHost(rest string) bool {
	for _, host := range []string{"localhost", "127.0.0.1"} {
		if hasHTTPHostBoundary(rest, host) {
			return true
		}
	}
	return false
}

func hasHTTPHostBoundary(rest, host string) bool {
	if !strings.HasPrefix(rest, host) {
		return false
	}
	if len(rest) == len(host) {
		return true
	}
	switch rest[len(host)] {
	case ':', '/', '?', '#':
		return true
	default:
		return false
	}
}
