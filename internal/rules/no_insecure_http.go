package rules

import (
	"regexp"

	"github.com/kadraman/codefence/internal/findings"
)

var noInsecureHTTP = Rule{
	ID:               IDNoInsecureHTTP,
	Severity:         findings.SeverityMedium,
	Message:          "Prefer HTTPS",
	re:               regexp.MustCompile(`http://`),
	skipIfFollowedBy: []string{"localhost", "127.0.0.1"},
}
