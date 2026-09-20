package config

import "time"

// Builtins returns the built-in defaults matching examples/codefence-config.yml.example.
func Builtins() Config {
	return Config{
		Aspects:            []string{"code"},
		Only:               nil,
		Skip:               nil,
		Format:             "table",
		Quiet:              false,
		Verbose:            false,
		GitIgnoredPrefixes: []string{},
		Deps: DepsConfig{
			Provider:    "osv",
			ProviderURL: "",
			Refresh:     false,
			CacheTTL:    24 * time.Hour,
			Timeout:     15 * time.Second,
			HTTP2:       "auto",
			Scope:       "changed",
		},
		Secret: SecretConfig{
			Rules:               []string{},
			DefaultRules:        "on",
			DefaultRulesVersion: "",
			RulesUpdateURL:      "",
			RulesRefresh:        false,
			RulesCacheTTL:       24 * time.Hour,
			EntropyThreshold:    4.2,
			MinLength:           12,
			MinConfidence:       "low",
		},
	}
}
