package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// EnvOverlay is a sparse overlay from CODEFENCE_* environment variables.
type EnvOverlay struct {
	Aspects            []string
	Only               []string
	Skip               []string
	Format             string
	Quiet              *bool
	Verbose            *bool
	GitIgnoredPrefixes []string

	DepsProvider    string
	DepsProviderURL *string
	DepsRefresh     *bool
	DepsCacheTTL    *time.Duration
	DepsTimeout     *time.Duration
	DepsHTTP2       string
	DepsScope       string

	SecretRules                []string
	SecretDefaultRules         string
	SecretDefaultRulesVersion  *string
	SecretRulesUpdateURL       *string
	SecretRulesRefresh         *bool
	SecretRulesCacheTTL        *time.Duration
	SecretEntropyThreshold     *float64
	SecretMinLength            *int
	SecretMinConfidence        string

	SetAspects             bool
	SetOnly                bool
	SetSkip                bool
	SetFormat              bool
	SetGitIgnoredPrefixes  bool
	SetDepsProvider        bool
	SetDepsHTTP2           bool
	SetDepsScope           bool
	SetSecretRules         bool
	SetSecretDefaultRules  bool
	SetSecretMinConfidence bool
}

type envSource interface {
	Getenv(key string) string
	LookupEnv(key string) (string, bool)
}

type osEnv struct{}

func (osEnv) Getenv(key string) string { return os.Getenv(key) }
func (osEnv) LookupEnv(key string) (string, bool) { return os.LookupEnv(key) }

type mapEnv map[string]string

func (m mapEnv) Getenv(key string) string { return m[key] }
func (m mapEnv) LookupEnv(key string) (string, bool) {
	v, ok := m[key]
	return v, ok
}

// ParseEnv reads CODEFENCE_* mirrors from the process environment.
func ParseEnv() (EnvOverlay, error) {
	return parseEnv(osEnv{})
}

func parseEnv(src envSource) (EnvOverlay, error) {
	var e EnvOverlay

	if v := src.Getenv("CODEFENCE_ASPECTS"); v != "" {
		aspects, err := splitCSVAspects(v)
		if err != nil {
			return e, fmt.Errorf("CODEFENCE_ASPECTS: %w", err)
		}
		e.Aspects = aspects
		e.SetAspects = true
	}
	if v := src.Getenv("CODEFENCE_ONLY"); v != "" {
		aspects, err := splitCSVAspects(v)
		if err != nil {
			return e, fmt.Errorf("CODEFENCE_ONLY: %w", err)
		}
		e.Only = aspects
		e.SetOnly = true
	}
	if v := src.Getenv("CODEFENCE_SKIP"); v != "" {
		aspects, err := splitCSVAspects(v)
		if err != nil {
			return e, fmt.Errorf("CODEFENCE_SKIP: %w", err)
		}
		e.Skip = aspects
		e.SetSkip = true
	}
	if v := src.Getenv("CODEFENCE_FORMAT"); v != "" {
		if err := validateFormat(v); err != nil {
			return e, fmt.Errorf("CODEFENCE_FORMAT: %w", err)
		}
		e.Format = v
		e.SetFormat = true
	}
	if v, ok := src.LookupEnv("CODEFENCE_QUIET"); ok && v != "" {
		b, err := parseBoolEnv(v)
		if err != nil {
			return e, fmt.Errorf("CODEFENCE_QUIET: %w", err)
		}
		e.Quiet = &b
	}
	if v, ok := src.LookupEnv("CODEFENCE_VERBOSE"); ok && v != "" {
		b, err := parseBoolEnv(v)
		if err != nil {
			return e, fmt.Errorf("CODEFENCE_VERBOSE: %w", err)
		}
		e.Verbose = &b
	}
	if v := src.Getenv("CODEFENCE_GIT_IGNORED_PREFIXES"); v != "" {
		e.GitIgnoredPrefixes = splitCSV(v)
		e.SetGitIgnoredPrefixes = true
	}

	if v := src.Getenv("CODEFENCE_DEPS_PROVIDER"); v != "" {
		if err := validateDepsProvider(v); err != nil {
			return e, fmt.Errorf("CODEFENCE_DEPS_PROVIDER: %w", err)
		}
		e.DepsProvider = v
		e.SetDepsProvider = true
	}
	if v, ok := src.LookupEnv("CODEFENCE_DEPS_PROVIDER_URL"); ok {
		e.DepsProviderURL = &v
	}
	if v, ok := src.LookupEnv("CODEFENCE_DEPS_REFRESH"); ok && v != "" {
		b, err := parseBoolEnv(v)
		if err != nil {
			return e, fmt.Errorf("CODEFENCE_DEPS_REFRESH: %w", err)
		}
		e.DepsRefresh = &b
	}
	if v := src.Getenv("CODEFENCE_DEPS_CACHE_TTL"); v != "" {
		d, err := time.ParseDuration(v)
		if err != nil {
			return e, fmt.Errorf("CODEFENCE_DEPS_CACHE_TTL: %w", err)
		}
		e.DepsCacheTTL = &d
	}
	if v := src.Getenv("CODEFENCE_DEPS_TIMEOUT"); v != "" {
		d, err := time.ParseDuration(v)
		if err != nil {
			return e, fmt.Errorf("CODEFENCE_DEPS_TIMEOUT: %w", err)
		}
		e.DepsTimeout = &d
	}
	if v := src.Getenv("CODEFENCE_DEPS_HTTP2"); v != "" {
		if err := validateHTTP2(v); err != nil {
			return e, fmt.Errorf("CODEFENCE_DEPS_HTTP2: %w", err)
		}
		e.DepsHTTP2 = v
		e.SetDepsHTTP2 = true
	}
	if v := src.Getenv("CODEFENCE_DEPS_SCOPE"); v != "" {
		if err := validateDepsScope(v); err != nil {
			return e, fmt.Errorf("CODEFENCE_DEPS_SCOPE: %w", err)
		}
		e.DepsScope = v
		e.SetDepsScope = true
	}

	if v := src.Getenv("CODEFENCE_SECRET_RULES"); v != "" {
		e.SecretRules = splitCSV(v)
		e.SetSecretRules = true
	}
	if v := src.Getenv("CODEFENCE_SECRET_DEFAULT_RULES"); v != "" {
		if err := validateOnOff(v); err != nil {
			return e, fmt.Errorf("CODEFENCE_SECRET_DEFAULT_RULES: %w", err)
		}
		e.SecretDefaultRules = v
		e.SetSecretDefaultRules = true
	}
	if v, ok := src.LookupEnv("CODEFENCE_SECRET_DEFAULT_RULES_VERSION"); ok {
		e.SecretDefaultRulesVersion = &v
	}
	if v, ok := src.LookupEnv("CODEFENCE_SECRET_RULES_UPDATE_URL"); ok {
		e.SecretRulesUpdateURL = &v
	}
	if v, ok := src.LookupEnv("CODEFENCE_SECRET_RULES_REFRESH"); ok && v != "" {
		b, err := parseBoolEnv(v)
		if err != nil {
			return e, fmt.Errorf("CODEFENCE_SECRET_RULES_REFRESH: %w", err)
		}
		e.SecretRulesRefresh = &b
	}
	if v := src.Getenv("CODEFENCE_SECRET_RULES_CACHE_TTL"); v != "" {
		d, err := time.ParseDuration(v)
		if err != nil {
			return e, fmt.Errorf("CODEFENCE_SECRET_RULES_CACHE_TTL: %w", err)
		}
		e.SecretRulesCacheTTL = &d
	}
	if v := src.Getenv("CODEFENCE_SECRET_ENTROPY_THRESHOLD"); v != "" {
		f, err := strconv.ParseFloat(strings.TrimSpace(v), 64)
		if err != nil {
			return e, fmt.Errorf("CODEFENCE_SECRET_ENTROPY_THRESHOLD: invalid number %q", v)
		}
		e.SecretEntropyThreshold = &f
	}
	if v := src.Getenv("CODEFENCE_SECRET_MIN_LENGTH"); v != "" {
		n, err := strconv.Atoi(strings.TrimSpace(v))
		if err != nil {
			return e, fmt.Errorf("CODEFENCE_SECRET_MIN_LENGTH: invalid integer %q", v)
		}
		e.SecretMinLength = &n
	}
	if v := src.Getenv("CODEFENCE_SECRET_MIN_CONFIDENCE"); v != "" {
		if err := validateConfidence(v); err != nil {
			return e, fmt.Errorf("CODEFENCE_SECRET_MIN_CONFIDENCE: %w", err)
		}
		e.SecretMinConfidence = v
		e.SetSecretMinConfidence = true
	}

	return e, nil
}

// parseBoolEnv treats 1|true|on|yes as truthy (case-insensitive).
func parseBoolEnv(v string) (bool, error) {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "1", "true", "on", "yes":
		return true, nil
	case "0", "false", "off", "no":
		return false, nil
	default:
		return false, fmt.Errorf("invalid boolean %q (want 1|true|on|yes or 0|false|off|no)", v)
	}
}

func splitCSV(s string) []string {
	raw := strings.Split(s, ",")
	out := make([]string, 0, len(raw))
	for _, p := range raw {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func splitCSVAspects(s string) ([]string, error) {
	parts := splitCSV(s)
	return normalizeAspects(parts)
}
