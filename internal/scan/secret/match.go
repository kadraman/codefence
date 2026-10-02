package secret

import (
	"fmt"
	"path/filepath"
	"regexp"
	"strings"
	"sync"

	"github.com/kadraman/codefence/internal/findings"
)

// processRules caches compiled rule sets across MCP tool calls / repeated scans
// in the same process (FR-009). Keyed by options fingerprint.
var (
	processRulesMu sync.Mutex
	processRules   = map[string][]Rule{}
)

// ClearProcessCache clears the in-memory compiled rule cache (tests / refresh).
func ClearProcessCache() {
	processRulesMu.Lock()
	defer processRulesMu.Unlock()
	processRules = map[string][]Rule{}
}

// LoadRulesCached returns compiled rules, reusing a process-lifetime cache when
// options match. CLI still lazy-loads: nothing is loaded until first call.
func LoadRulesCached(workspace string, opts Options) ([]Rule, error) {
	opts = opts.Normalize()
	key := cacheKey(workspace, opts)
	processRulesMu.Lock()
	if cached, ok := processRules[key]; ok && !opts.RulesRefresh {
		out := cached
		processRulesMu.Unlock()
		return out, nil
	}
	processRulesMu.Unlock()

	rules, err := LoadRules(workspace, opts)
	if err != nil {
		return nil, err
	}

	processRulesMu.Lock()
	processRules[key] = rules
	processRulesMu.Unlock()
	return rules, nil
}

func cacheKey(workspace string, opts Options) string {
	abs := workspace
	if workspace != "" {
		if a, err := filepath.Abs(workspace); err == nil {
			abs = a
		}
	}
	return fmt.Sprintf(
		"%s|%v|%s|%s|%s|%v|%s|%g|%d|%s",
		abs,
		opts.RulePaths,
		opts.DefaultRules,
		opts.DefaultRulesVersion,
		opts.RulesUpdateURL,
		opts.RulesRefresh,
		opts.RulesCacheTTL.String(),
		opts.EntropyThreshold,
		opts.MinLength,
		opts.MinConfidence,
	)
}

// CompileRules compiles all regex patterns once (mutates Patterns in place).
func CompileRules(rules []Rule) error {
	for i := range rules {
		for j := range rules[i].Patterns {
			p := &rules[i].Patterns[j]
			if p.Kind != PatternRegex {
				continue
			}
			expr := p.Value
			if p.CaseInsensitive {
				expr = "(?i)" + expr
			}
			re, err := regexp.Compile(expr)
			if err != nil {
				return fmt.Errorf("compile secret rule %s: %w", rules[i].ID, err)
			}
			p.compiled = re
		}
	}
	return nil
}

// MatchRules runs compiled rules against file lines and returns rule findings.
func MatchRules(filePath string, lines []string, rules []Rule) []findings.Finding {
	var out []findings.Finding
	for lineIdx, line := range lines {
		for _, rule := range rules {
			for _, pattern := range rule.Patterns {
				hit := false
				matchLen := 0
				switch pattern.Kind {
				case PatternLiteral:
					if strings.Contains(line, pattern.Value) {
						hit = true
						matchLen = len(pattern.Value)
					}
				case PatternRegex:
					re := pattern.compiled
					if re == nil {
						continue
					}
					m := re.FindString(line)
					if m != "" {
						hit = true
						matchLen = len(m)
					}
				}
				if !hit {
					continue
				}
				out = append(out, findings.Finding{
					RuleID:          rule.ID,
					Message:         rule.Message,
					FilePath:        filePath,
					Line:            lineIdx + 1,
					Severity:        rule.Severity,
					Confidence:      rule.Confidence,
					Evidence:        SummarizeMatch(matchLen, rule.SourceName),
					Remediation:     rule.Remediation,
					Kind:            findings.KindSecret,
					DetectionMethod: findings.DetectionRule,
				})
			}
		}
	}
	return out
}
