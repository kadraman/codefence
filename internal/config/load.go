package config

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"gopkg.in/yaml.v3"
)

// LoadFile loads codefence-config.yml from cwd only (no upward walk).
// Missing file returns (Builtins-equivalent file layer as zero overlay applied later via merge),
// specifically ok=false with a nil error so callers use builtins.
func LoadFile(cwd string) (partial Config, found bool, err error) {
	path := filepath.Join(cwd, FileName)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return Config{}, false, nil
		}
		return Config{}, false, fmt.Errorf("read %s: %w", path, err)
	}
	cfg, err := ParseYAML(data)
	if err != nil {
		return Config{}, false, err
	}
	return cfg, true, nil
}

// ParseYAML parses and validates a version-1 config document.
// Unknown mapping keys are rejected (strict schema).
func ParseYAML(data []byte) (Config, error) {
	var doc fileDoc
	dec := yaml.NewDecoder(bytes.NewReader(data))
	dec.KnownFields(true)
	if err := dec.Decode(&doc); err != nil {
		return Config{}, fmt.Errorf("invalid config YAML: %w", err)
	}
	if doc.Version == 0 {
		return Config{}, fmt.Errorf("config: missing version (want %d)", SchemaVersion)
	}
	if doc.Version != SchemaVersion {
		return Config{}, fmt.Errorf("config: unsupported version %d (want %d)", doc.Version, SchemaVersion)
	}
	return fileToConfig(doc)
}

func fileToConfig(doc fileDoc) (Config, error) {
	cfg := Builtins()

	if len(doc.Scan.Aspects) > 0 {
		aspects, err := normalizeAspects(doc.Scan.Aspects)
		if err != nil {
			return Config{}, fmt.Errorf("config scan.aspects: %w", err)
		}
		cfg.Aspects = aspects
	}
	if doc.Scan.Format != "" {
		if err := validateFormat(doc.Scan.Format); err != nil {
			return Config{}, fmt.Errorf("config scan.format: %w", err)
		}
		cfg.Format = doc.Scan.Format
	}
	if doc.Scan.Quiet != nil {
		cfg.Quiet = *doc.Scan.Quiet
	}
	if doc.Scan.Verbose != nil {
		cfg.Verbose = *doc.Scan.Verbose
	}

	if doc.Paths.GitIgnoredPrefixes != nil {
		cfg.GitIgnoredPrefixes = append([]string(nil), doc.Paths.GitIgnoredPrefixes...)
	}

	if doc.Deps.Provider != "" {
		if err := validateDepsProvider(doc.Deps.Provider); err != nil {
			return Config{}, fmt.Errorf("config deps.provider: %w", err)
		}
		cfg.Deps.Provider = doc.Deps.Provider
	}
	if doc.Deps.ProviderURL != nil {
		cfg.Deps.ProviderURL = *doc.Deps.ProviderURL
	}
	if doc.Deps.Refresh != nil {
		cfg.Deps.Refresh = *doc.Deps.Refresh
	}
	if doc.Deps.CacheTTL != "" {
		d, err := time.ParseDuration(doc.Deps.CacheTTL)
		if err != nil {
			return Config{}, fmt.Errorf("config deps.cache_ttl: %w", err)
		}
		cfg.Deps.CacheTTL = d
	}
	if doc.Deps.Timeout != "" {
		d, err := time.ParseDuration(doc.Deps.Timeout)
		if err != nil {
			return Config{}, fmt.Errorf("config deps.timeout: %w", err)
		}
		cfg.Deps.Timeout = d
	}
	if doc.Deps.HTTP2 != "" {
		if err := validateHTTP2(doc.Deps.HTTP2); err != nil {
			return Config{}, fmt.Errorf("config deps.http2: %w", err)
		}
		cfg.Deps.HTTP2 = doc.Deps.HTTP2
	}
	if doc.Deps.Scope != "" {
		if err := validateDepsScope(doc.Deps.Scope); err != nil {
			return Config{}, fmt.Errorf("config deps.scope: %w", err)
		}
		cfg.Deps.Scope = doc.Deps.Scope
	}

	if doc.Secret.Rules != nil {
		cfg.Secret.Rules = append([]string(nil), doc.Secret.Rules...)
	}
	if doc.Secret.DefaultRules != "" {
		if err := validateOnOff(doc.Secret.DefaultRules); err != nil {
			return Config{}, fmt.Errorf("config secret.default_rules: %w", err)
		}
		cfg.Secret.DefaultRules = doc.Secret.DefaultRules
	}
	if doc.Secret.DefaultRulesVersion != nil {
		cfg.Secret.DefaultRulesVersion = *doc.Secret.DefaultRulesVersion
	}
	if doc.Secret.RulesUpdateURL != nil {
		cfg.Secret.RulesUpdateURL = *doc.Secret.RulesUpdateURL
	}
	if doc.Secret.RulesRefresh != nil {
		cfg.Secret.RulesRefresh = *doc.Secret.RulesRefresh
	}
	if doc.Secret.RulesCacheTTL != "" {
		d, err := time.ParseDuration(doc.Secret.RulesCacheTTL)
		if err != nil {
			return Config{}, fmt.Errorf("config secret.rules_cache_ttl: %w", err)
		}
		cfg.Secret.RulesCacheTTL = d
	}
	if doc.Secret.EntropyThreshold != nil {
		cfg.Secret.EntropyThreshold = *doc.Secret.EntropyThreshold
	}
	if doc.Secret.MinLength != nil {
		cfg.Secret.MinLength = *doc.Secret.MinLength
	}
	if doc.Secret.MinConfidence != "" {
		if err := validateConfidence(doc.Secret.MinConfidence); err != nil {
			return Config{}, fmt.Errorf("config secret.min_confidence: %w", err)
		}
		cfg.Secret.MinConfidence = doc.Secret.MinConfidence
	}

	return cfg, nil
}

func normalizeAspects(in []string) ([]string, error) {
	if len(in) == 0 {
		return nil, fmt.Errorf("aspects list is empty")
	}
	out := make([]string, 0, len(in))
	seen := map[string]bool{}
	for _, p := range in {
		switch p {
		case "code", "deps":
			if !seen[p] {
				seen[p] = true
				out = append(out, p)
			}
		default:
			return nil, fmt.Errorf("unknown aspect %q (want code or deps)", p)
		}
	}
	return out, nil
}

func validateFormat(v string) error {
	switch v {
	case "table", "json":
		return nil
	default:
		return fmt.Errorf("must be table or json")
	}
}

func validateDepsProvider(v string) error {
	switch v {
	case "osv", "custom":
		return nil
	default:
		return fmt.Errorf("must be osv or custom")
	}
}

func validateHTTP2(v string) error {
	switch v {
	case "auto", "on", "off":
		return nil
	default:
		return fmt.Errorf("must be auto, on, or off")
	}
}

func validateDepsScope(v string) error {
	switch v {
	case "changed", "tree":
		return nil
	default:
		return fmt.Errorf("must be changed or tree")
	}
}

func validateOnOff(v string) error {
	switch v {
	case "on", "off":
		return nil
	default:
		return fmt.Errorf("must be on or off")
	}
}

func validateConfidence(v string) error {
	switch v {
	case "low", "medium", "high":
		return nil
	default:
		return fmt.Errorf("must be low, medium, or high")
	}
}
