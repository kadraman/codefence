package scan

import (
	"time"

	"github.com/kadraman/codefence/internal/findings"
)

// AspectID identifies a scan aspect.
type AspectID string

const (
	AspectCode AspectID = "code"
	AspectDeps AspectID = "deps"
)

// Status values for AspectOutcome.
const (
	StatusOK      = "ok"
	StatusSkipped = "skipped"
	StatusFailed  = "failed"
)

// Options are resolved scan options (after CLI/config merge).
type Options struct {
	Staged             bool
	Paths              []string
	Only               []string
	Skip               []string
	Aspects            []string // default aspects when Only empty
	Format             string
	Quiet              bool
	Verbose            bool
	GitIgnoredPrefixes []string
	DepsScope          string // changed | tree

	// Passed through for later aspect engines (006–009).
	DepsProvider    string
	DepsProviderURL string
	DepsRefresh     bool
	DepsCacheTTL    time.Duration
	DepsTimeout     time.Duration
	DepsHTTP2       string

	SecretRules               []string
	SecretDefaultRules        string
	SecretDefaultRulesVersion string
	SecretRulesUpdateURL      string
	SecretRulesRefresh        bool
	SecretRulesCacheTTL       time.Duration
	SecretEntropyThreshold    float64
	SecretMinLength           int
	SecretMinConfidence       string
}

// Context is the built scan context.
type Context struct {
	CWD               string
	Files             []string
	Staged            bool
	ExplicitPaths     bool
	DepsManifestPaths []string // non-nil when tree scope
	Options           Options
}

// AspectOutcome is the result of one aspect run.
type AspectOutcome struct {
	Aspect     AspectID
	Status     string
	ExitCode   int
	Message    string
	Findings   []findings.Finding
}

// Result aggregates a full RunScan.
type Result struct {
	Outcomes []AspectOutcome
	ExitCode int
}

// AspectRunner executes one aspect.
type AspectRunner func(ctx Context) AspectOutcome
