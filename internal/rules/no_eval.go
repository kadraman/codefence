package rules

import "github.com/kadraman/codefence/internal/findings"

var noEval = MustCompile(
	IDNoEval,
	findings.SeverityHigh,
	"Avoid eval/new Function",
	0,
	`\beval\s*\(|\bnew\s+Function\s*\(`,
)
