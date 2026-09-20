package cli

import (
	"github.com/kadraman/codefence/internal/config"
)

// flagsFromScanOptions maps presence-tracked ScanOptions into config.Flags.
func flagsFromScanOptions(o ScanOptions) config.Flags {
	return config.Flags{
		Only:                         append([]string(nil), o.Only...),
		Skip:                         append([]string(nil), o.Skip...),
		Format:                       o.Format,
		Quiet:                        o.Quiet,
		Verbose:                      o.Verbose,
		DepsProvider:                 o.DepsProvider,
		DepsProviderURL:              o.DepsProviderURL,
		DepsRefresh:                  o.DepsRefresh,
		DepsCacheTTL:                 o.DepsCacheTTL,
		DepsTimeout:                  o.DepsTimeout,
		DepsHTTP2:                    o.DepsHTTP2,
		DepsScope:                    o.DepsScope,
		SecretRules:                  append([]string(nil), o.SecretRules...),
		SecretDefaultRules:           o.SecretDefaultRules,
		SecretDefaultRulesVersion:    o.SecretDefaultRulesVersion,
		SecretRulesUpdateURL:         o.SecretRulesUpdateURL,
		SecretRulesRefresh:           o.SecretRulesRefresh,
		SecretRulesCacheTTL:          o.SecretRulesCacheTTL,
		SecretEntropyThreshold:       o.SecretEntropyThreshold,
		SecretMinLength:              o.SecretMinLength,
		SecretMinConfidence:          o.SecretMinConfidence,
		SetOnly:                      o.SetOnly,
		SetSkip:                      o.SetSkip,
		SetFormat:                    o.SetFormat,
		SetQuiet:                     o.SetQuiet,
		SetVerbose:                   o.SetVerbose,
		SetDepsProvider:              o.SetDepsProvider,
		SetDepsProviderURL:           o.SetDepsProviderURL,
		SetDepsRefresh:               o.SetDepsRefresh,
		SetDepsCacheTTL:              o.SetDepsCacheTTL,
		SetDepsTimeout:                o.SetDepsTimeout,
		SetDepsHTTP2:                  o.SetDepsHTTP2,
		SetDepsScope:                  o.SetDepsScope,
		SetSecretRules:               o.SetSecretRules,
		SetSecretDefaultRules:        o.SetSecretDefaultRules,
		SetSecretDefaultRulesVersion: o.SetSecretDefaultRulesVersion,
		SetSecretRulesUpdateURL:      o.SetSecretRulesUpdateURL,
		SetSecretRulesRefresh:        o.SetSecretRulesRefresh,
		SetSecretRulesCacheTTL:       o.SetSecretRulesCacheTTL,
		SetSecretEntropyThreshold:    o.SetSecretEntropyThreshold,
		SetSecretMinLength:           o.SetSecretMinLength,
		SetSecretMinConfidence:       o.SetSecretMinConfidence,
	}
}

func resolveForTest(opts ScanOptions) (config.Config, error) {
	return config.ResolveCWD(flagsFromScanOptions(opts))
}

// applyMergedConfig copies resolved config onto scan options (CLI-present values already win).
func applyMergedConfig(o *ScanOptions, cfg config.Config) {
	if !o.SetOnly && len(cfg.Only) > 0 {
		o.Only = append([]string(nil), cfg.Only...)
	}
	if !o.SetSkip && len(cfg.Skip) > 0 {
		o.Skip = append([]string(nil), cfg.Skip...)
	}
	o.Aspects = append([]string(nil), cfg.Aspects...)
	o.GitIgnoredPrefixes = append([]string(nil), cfg.GitIgnoredPrefixes...)

	if !o.SetFormat {
		o.Format = cfg.Format
	}
	if !o.SetQuiet {
		o.Quiet = cfg.Quiet
	}
	if !o.SetVerbose {
		o.Verbose = cfg.Verbose
	}

	if !o.SetDepsProvider {
		o.DepsProvider = cfg.Deps.Provider
	}
	if !o.SetDepsProviderURL {
		o.DepsProviderURL = cfg.Deps.ProviderURL
	}
	if !o.SetDepsRefresh {
		o.DepsRefresh = cfg.Deps.Refresh
	}
	if !o.SetDepsCacheTTL {
		o.DepsCacheTTL = cfg.Deps.CacheTTL
	}
	if !o.SetDepsTimeout {
		o.DepsTimeout = cfg.Deps.Timeout
	}
	if !o.SetDepsHTTP2 {
		o.DepsHTTP2 = cfg.Deps.HTTP2
	}
	if !o.SetDepsScope {
		o.DepsScope = cfg.Deps.Scope
	}

	if !o.SetSecretRules {
		o.SecretRules = append([]string(nil), cfg.Secret.Rules...)
	}
	if !o.SetSecretDefaultRules {
		o.SecretDefaultRules = cfg.Secret.DefaultRules
	}
	if !o.SetSecretDefaultRulesVersion {
		o.SecretDefaultRulesVersion = cfg.Secret.DefaultRulesVersion
	}
	if !o.SetSecretRulesUpdateURL {
		o.SecretRulesUpdateURL = cfg.Secret.RulesUpdateURL
	}
	if !o.SetSecretRulesRefresh {
		o.SecretRulesRefresh = cfg.Secret.RulesRefresh
	}
	if !o.SetSecretRulesCacheTTL {
		o.SecretRulesCacheTTL = cfg.Secret.RulesCacheTTL
	}
	if !o.SetSecretEntropyThreshold {
		o.SecretEntropyThreshold = cfg.Secret.EntropyThreshold
	}
	if !o.SetSecretMinLength {
		o.SecretMinLength = cfg.Secret.MinLength
	}
	if !o.SetSecretMinConfidence {
		o.SecretMinConfidence = cfg.Secret.MinConfidence
	}
}
