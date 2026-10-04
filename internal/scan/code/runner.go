// Package code implements the code aspect: secure-coding rules and secret engine.
package code

import (
	"bufio"
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/kadraman/codefence/internal/findings"
	"github.com/kadraman/codefence/internal/rules"
	"github.com/kadraman/codefence/internal/scan/secret"
)

// SecretOptions mirrors scan/cli secret settings for the code aspect.
type SecretOptions struct {
	Rules               []string
	DefaultRules        string
	DefaultRulesVersion string
	RulesUpdateURL      string
	RulesRefresh        bool
	RulesCacheTTL       time.Duration
	EntropyThreshold    float64
	MinLength           int
	MinConfidence       string
	Warn                func(string)
}

// ToSecret converts to secret.Options with defaults applied.
func (o SecretOptions) ToSecret() secret.Options {
	return secret.Options{
		RulePaths:           append([]string(nil), o.Rules...),
		DefaultRules:        o.DefaultRules,
		DefaultRulesVersion: o.DefaultRulesVersion,
		RulesUpdateURL:      o.RulesUpdateURL,
		RulesRefresh:        o.RulesRefresh,
		RulesCacheTTL:       o.RulesCacheTTL,
		EntropyThreshold:    o.EntropyThreshold,
		MinLength:           o.MinLength,
		MinConfidence:       o.MinConfidence,
		Warn:                o.Warn,
	}.Normalize()
}

// ScanFiles runs built-in secure-coding rules and the secret engine on scannable files.
// Secret rules are loaded lazily on first call (not at process start).
func ScanFiles(cwd string, files []string, secretOpts SecretOptions) ([]findings.Finding, error) {
	codeFindings, err := scanWithRules(cwd, files, rules.Builtin())
	if err != nil {
		return nil, err
	}
	secretFindings, err := secret.ScanFiles(cwd, FilterScannable(files), secretOpts.ToSecret())
	if err != nil {
		return nil, err
	}
	out := make([]findings.Finding, 0, len(codeFindings)+len(secretFindings))
	out = append(out, codeFindings...)
	out = append(out, secretFindings...)
	return out, nil
}

func scanWithRules(cwd string, files []string, rs []rules.Rule) ([]findings.Finding, error) {
	var out []findings.Finding
	for _, rel := range FilterScannable(files) {
		abs := rel
		if cwd != "" && !filepath.IsAbs(rel) {
			abs = filepath.Join(cwd, rel)
		}
		data, err := os.ReadFile(abs)
		if err != nil {
			return nil, fmt.Errorf("read %s: %w", rel, err)
		}
		if bytes.IndexByte(data, 0) >= 0 {
			continue
		}
		hits, err := scanBytes(rel, data, rs)
		if err != nil {
			return nil, fmt.Errorf("scan %s: %w", rel, err)
		}
		out = append(out, hits...)
	}
	return out, nil
}

func scanBytes(rel string, data []byte, rs []rules.Rule) ([]findings.Finding, error) {
	lines, err := splitLines(data)
	if err != nil {
		return nil, err
	}
	rel = filepath.ToSlash(rel)
	var out []findings.Finding
	for _, rule := range rs {
		win := rule.LineWindow()
		if win == 1 {
			for i, line := range lines {
				if rule.Match(line) {
					out = append(out, findingFor(rule, rel, i+1, line))
				}
			}
			continue
		}
		for i := 0; i+win <= len(lines); i++ {
			window := strings.Join(lines[i:i+win], "\n")
			if rule.Match(window) {
				out = append(out, findingFor(rule, rel, i+1, lines[i]))
			}
		}
	}
	return out, nil
}

func findingFor(rule rules.Rule, rel string, line int, evidence string) findings.Finding {
	return findings.Finding{
		RuleID:   rule.ID,
		Message:  rule.Message,
		FilePath: rel,
		Line:     line,
		Severity: rule.Severity,
		Kind:     findings.KindCode,
		Evidence: evidence,
	}
}

func splitLines(data []byte) ([]string, error) {
	s := bufio.NewScanner(bytes.NewReader(data))
	buf := make([]byte, 64*1024)
	s.Buffer(buf, 1024*1024)
	var lines []string
	for s.Scan() {
		lines = append(lines, s.Text())
	}
	return lines, s.Err()
}
