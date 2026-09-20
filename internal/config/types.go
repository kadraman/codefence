package config

import "time"

// FileName is the cwd-only config filename (v1; no upward walk).
const FileName = "codefence-config.yml"

// SchemaVersion is the only supported schema version.
const SchemaVersion = 1

// Config is the fully merged runtime configuration.
type Config struct {
	Aspects            []string
	Only               []string
	Skip               []string
	Format             string
	Quiet              bool
	Verbose            bool
	GitIgnoredPrefixes []string
	Deps               DepsConfig
	Secret             SecretConfig
}

// DepsConfig holds dependency-scan settings.
type DepsConfig struct {
	Provider    string
	ProviderURL string // empty when unset / null in YAML
	Refresh     bool
	CacheTTL    time.Duration
	Timeout     time.Duration
	HTTP2       string
	Scope       string
}

// SecretConfig holds secret-engine settings.
type SecretConfig struct {
	Rules               []string
	DefaultRules        string
	DefaultRulesVersion string // empty when unset / null
	RulesUpdateURL      string // empty when unset / null
	RulesRefresh        bool
	RulesCacheTTL       time.Duration
	EntropyThreshold    float64
	MinLength           int
	MinConfidence       string
}

// fileDoc is the on-disk YAML schema (version 1).
type fileDoc struct {
	Version int            `yaml:"version"`
	Scan    fileScan       `yaml:"scan"`
	Paths   filePaths      `yaml:"paths"`
	Deps    fileDeps       `yaml:"deps"`
	Secret  fileSecret     `yaml:"secret"`
}

type fileScan struct {
	Aspects []string `yaml:"aspects"`
	Format  string   `yaml:"format"`
	Quiet   *bool    `yaml:"quiet"`
	Verbose *bool    `yaml:"verbose"`
}

type filePaths struct {
	GitIgnoredPrefixes []string `yaml:"git_ignored_prefixes"`
}

type fileDeps struct {
	Provider    string  `yaml:"provider"`
	ProviderURL *string `yaml:"provider_url"`
	Refresh     *bool   `yaml:"refresh"`
	CacheTTL    string  `yaml:"cache_ttl"`
	Timeout     string  `yaml:"timeout"`
	HTTP2       string  `yaml:"http2"`
	Scope       string  `yaml:"scope"`
}

type fileSecret struct {
	Rules               []string `yaml:"rules"`
	DefaultRules        string   `yaml:"default_rules"`
	DefaultRulesVersion *string  `yaml:"default_rules_version"`
	RulesUpdateURL      *string  `yaml:"rules_update_url"`
	RulesRefresh        *bool    `yaml:"rules_refresh"`
	RulesCacheTTL       string   `yaml:"rules_cache_ttl"`
	EntropyThreshold    *float64 `yaml:"entropy_threshold"`
	MinLength           *int     `yaml:"min_length"`
	MinConfidence       string   `yaml:"min_confidence"`
}

// Flags holds CLI values that were explicitly set (presence-tracked).
// Defined here so config does not import internal/cli.
type Flags struct {
	Only []string
	Skip []string

	Format  string
	Quiet   bool
	Verbose bool

	DepsProvider    string
	DepsProviderURL string
	DepsRefresh     bool
	DepsCacheTTL    time.Duration
	DepsTimeout     time.Duration
	DepsHTTP2       string
	DepsScope       string

	SecretRules               []string
	SecretDefaultRules        string
	SecretDefaultRulesVersion string
	SecretRulesUpdateURL      string
	SecretRulesRefresh        bool
	SecretRulesCacheTTL       time.Duration
	SecretEntropyThreshold    float64
	SecretMinLength           int
	SecretMinConfidence       string

	SetOnly                      bool
	SetSkip                      bool
	SetFormat                    bool
	SetQuiet                     bool
	SetVerbose                   bool
	SetDepsProvider              bool
	SetDepsProviderURL           bool
	SetDepsRefresh               bool
	SetDepsCacheTTL              bool
	SetDepsTimeout               bool
	SetDepsHTTP2                 bool
	SetDepsScope                 bool
	SetSecretRules               bool
	SetSecretDefaultRules        bool
	SetSecretDefaultRulesVersion bool
	SetSecretRulesUpdateURL      bool
	SetSecretRulesRefresh        bool
	SetSecretRulesCacheTTL       bool
	SetSecretEntropyThreshold    bool
	SetSecretMinLength           bool
	SetSecretMinConfidence       bool
}
