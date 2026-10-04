package secret

import (
	"regexp"
	"time"

	"github.com/kadraman/codefence/internal/findings"
)

// Defaults from feature 007 / config builtins.
const (
	DefaultEntropyThreshold = 4.2
	DefaultMinLength        = 12
	DefaultMinConfidence    = "low"
	DefaultCacheTTL         = 24 * time.Hour
	RuleHighEntropy         = "secret-high-entropy"
)

// Options controls secret engine loading and detection.
type Options struct {
	RulePaths            []string
	DefaultRules         string // on|off
	DefaultRulesVersion  string
	RulesUpdateURL       string
	RulesRefresh         bool
	RulesCacheTTL        time.Duration
	EntropyThreshold     float64
	MinLength            int
	MinConfidence        string
	// Warn receives non-fatal rule-loading warnings (e.g. remote cache fallback).
	// It is not part of the process rule-cache key.
	Warn func(string)
}

// DefaultOptions returns production defaults (builtin on, entropy 4.2, etc.).
func DefaultOptions() Options {
	return Options{
		DefaultRules:     "on",
		RulesCacheTTL:    DefaultCacheTTL,
		EntropyThreshold: DefaultEntropyThreshold,
		MinLength:        DefaultMinLength,
		MinConfidence:    DefaultMinConfidence,
	}
}

// Normalize fills zero-value fields with defaults.
func (o Options) Normalize() Options {
	out := o
	if out.DefaultRules == "" {
		out.DefaultRules = "on"
	}
	if out.RulesCacheTTL == 0 {
		out.RulesCacheTTL = DefaultCacheTTL
	}
	if out.EntropyThreshold == 0 {
		out.EntropyThreshold = DefaultEntropyThreshold
	}
	if out.MinLength == 0 {
		out.MinLength = DefaultMinLength
	}
	if out.MinConfidence == "" {
		out.MinConfidence = DefaultMinConfidence
	}
	return out
}

// DefaultRulesOn reports whether builtin rules are enabled.
func (o Options) DefaultRulesOn() bool {
	return o.Normalize().DefaultRules != "off"
}

// PatternKind is regex or literal.
type PatternKind string

const (
	PatternRegex   PatternKind = "regex"
	PatternLiteral PatternKind = "literal"
)

// Pattern is one Semgrep-subset match pattern.
type Pattern struct {
	Kind             PatternKind
	Value            string
	CaseInsensitive  bool
	compiled         *regexp.Regexp // set for regex patterns after Compile
}

// Rule is a compiled secret detection rule.
type Rule struct {
	ID          string
	Description string
	Message     string
	Severity    findings.Severity
	Confidence  findings.Confidence
	Remediation string
	Patterns    []Pattern
	Source      string // builtin | custom | remote
	SourceName  string
}

// Source labels for Rule.Source.
const (
	SourceBuiltin = "builtin"
	SourceCustom  = "custom"
	SourceRemote  = "remote"
)
