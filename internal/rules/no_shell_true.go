package rules

import "github.com/kadraman/codefence/internal/findings"

var noShellTrue = MustCompile(
	IDNoShellTrue,
	findings.SeverityMedium,
	"Avoid shell-enabled child_process",
	0,
	`shell\s*:\s*true`,
)
