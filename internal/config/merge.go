package config

import (
	"fmt"
	"os"
)

// Resolve loads cwd config, env overlays, and CLI flags with precedence:
// CLI flags > CODEFENCE_* env > codefence-config.yml > builtins.
func Resolve(cwd string, flags Flags) (Config, error) {
	fileCfg, found, err := LoadFile(cwd)
	if err != nil {
		return Config{}, err
	}
	env, err := ParseEnv()
	if err != nil {
		return Config{}, err
	}
	return Merge(Builtins(), fileCfg, found, env, flags), nil
}

// ResolveCWD is Resolve using the process working directory.
func ResolveCWD(flags Flags) (Config, error) {
	cwd, err := os.Getwd()
	if err != nil {
		return Config{}, fmt.Errorf("resolve cwd: %w", err)
	}
	return Resolve(cwd, flags)
}

// Merge applies layers: builtins ← file (if found) ← env ← flags.
func Merge(builtins Config, file Config, fileFound bool, env EnvOverlay, flags Flags) Config {
	cfg := cloneConfig(builtins)
	if fileFound {
		cfg = cloneConfig(file)
	}
	applyEnv(&cfg, env)
	applyFlags(&cfg, flags)
	return cfg
}

func cloneConfig(c Config) Config {
	out := c
	if c.Aspects != nil {
		out.Aspects = append([]string(nil), c.Aspects...)
	}
	if c.Only != nil {
		out.Only = append([]string(nil), c.Only...)
	}
	if c.Skip != nil {
		out.Skip = append([]string(nil), c.Skip...)
	}
	if c.GitIgnoredPrefixes != nil {
		out.GitIgnoredPrefixes = append([]string(nil), c.GitIgnoredPrefixes...)
	}
	if c.Secret.Rules != nil {
		out.Secret.Rules = append([]string(nil), c.Secret.Rules...)
	}
	return out
}

func applyEnv(cfg *Config, e EnvOverlay) {
	if e.SetAspects {
		cfg.Aspects = append([]string(nil), e.Aspects...)
	}
	if e.SetOnly {
		cfg.Only = append([]string(nil), e.Only...)
	}
	if e.SetSkip {
		cfg.Skip = append([]string(nil), e.Skip...)
	}
	if e.SetFormat {
		cfg.Format = e.Format
	}
	if e.Quiet != nil {
		cfg.Quiet = *e.Quiet
	}
	if e.Verbose != nil {
		cfg.Verbose = *e.Verbose
	}
	if e.SetGitIgnoredPrefixes {
		cfg.GitIgnoredPrefixes = append([]string(nil), e.GitIgnoredPrefixes...)
	}

	if e.SetDepsProvider {
		cfg.Deps.Provider = e.DepsProvider
	}
	if e.DepsProviderURL != nil {
		cfg.Deps.ProviderURL = *e.DepsProviderURL
	}
	if e.DepsRefresh != nil {
		cfg.Deps.Refresh = *e.DepsRefresh
	}
	if e.DepsCacheTTL != nil {
		cfg.Deps.CacheTTL = *e.DepsCacheTTL
	}
	if e.DepsTimeout != nil {
		cfg.Deps.Timeout = *e.DepsTimeout
	}
	if e.SetDepsHTTP2 {
		cfg.Deps.HTTP2 = e.DepsHTTP2
	}
	if e.SetDepsScope {
		cfg.Deps.Scope = e.DepsScope
	}

	if e.SetSecretRules {
		cfg.Secret.Rules = append([]string(nil), e.SecretRules...)
	}
	if e.SetSecretDefaultRules {
		cfg.Secret.DefaultRules = e.SecretDefaultRules
	}
	if e.SecretDefaultRulesVersion != nil {
		cfg.Secret.DefaultRulesVersion = *e.SecretDefaultRulesVersion
	}
	if e.SecretRulesUpdateURL != nil {
		cfg.Secret.RulesUpdateURL = *e.SecretRulesUpdateURL
	}
	if e.SecretRulesRefresh != nil {
		cfg.Secret.RulesRefresh = *e.SecretRulesRefresh
	}
	if e.SecretRulesCacheTTL != nil {
		cfg.Secret.RulesCacheTTL = *e.SecretRulesCacheTTL
	}
	if e.SecretEntropyThreshold != nil {
		cfg.Secret.EntropyThreshold = *e.SecretEntropyThreshold
	}
	if e.SecretMinLength != nil {
		cfg.Secret.MinLength = *e.SecretMinLength
	}
	if e.SetSecretMinConfidence {
		cfg.Secret.MinConfidence = e.SecretMinConfidence
	}
}

func applyFlags(cfg *Config, f Flags) {
	if f.SetOnly {
		cfg.Only = append([]string(nil), f.Only...)
	}
	if f.SetSkip {
		cfg.Skip = append([]string(nil), f.Skip...)
	}
	if f.SetFormat {
		cfg.Format = f.Format
	}
	if f.SetQuiet {
		cfg.Quiet = f.Quiet
	}
	if f.SetVerbose {
		cfg.Verbose = f.Verbose
	}

	if f.SetDepsProvider {
		cfg.Deps.Provider = f.DepsProvider
	}
	if f.SetDepsProviderURL {
		cfg.Deps.ProviderURL = f.DepsProviderURL
	}
	if f.SetDepsRefresh {
		cfg.Deps.Refresh = f.DepsRefresh
	}
	if f.SetDepsCacheTTL {
		cfg.Deps.CacheTTL = f.DepsCacheTTL
	}
	if f.SetDepsTimeout {
		cfg.Deps.Timeout = f.DepsTimeout
	}
	if f.SetDepsHTTP2 {
		cfg.Deps.HTTP2 = f.DepsHTTP2
	}
	if f.SetDepsScope {
		cfg.Deps.Scope = f.DepsScope
	}

	if f.SetSecretRules {
		cfg.Secret.Rules = append([]string(nil), f.SecretRules...)
	}
	if f.SetSecretDefaultRules {
		cfg.Secret.DefaultRules = f.SecretDefaultRules
	}
	if f.SetSecretDefaultRulesVersion {
		cfg.Secret.DefaultRulesVersion = f.SecretDefaultRulesVersion
	}
	if f.SetSecretRulesUpdateURL {
		cfg.Secret.RulesUpdateURL = f.SecretRulesUpdateURL
	}
	if f.SetSecretRulesRefresh {
		cfg.Secret.RulesRefresh = f.SecretRulesRefresh
	}
	if f.SetSecretRulesCacheTTL {
		cfg.Secret.RulesCacheTTL = f.SecretRulesCacheTTL
	}
	if f.SetSecretEntropyThreshold {
		cfg.Secret.EntropyThreshold = f.SecretEntropyThreshold
	}
	if f.SetSecretMinLength {
		cfg.Secret.MinLength = f.SecretMinLength
	}
	if f.SetSecretMinConfidence {
		cfg.Secret.MinConfidence = f.SecretMinConfidence
	}
}
