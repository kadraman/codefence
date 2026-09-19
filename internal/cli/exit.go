package cli

// Process exit codes (see specs/global/architecture.md).
const (
	ExitOK       = 0 // help, success with no findings
	ExitFindings = 1 // findings in a run aspect
	ExitUsage    = 2 // usage / flag / config errors
)
