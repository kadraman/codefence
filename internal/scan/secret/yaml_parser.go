package secret

import (
	"fmt"
	"io"
	"regexp"
	"strings"

	"github.com/kadraman/codefence/internal/findings"
	"gopkg.in/yaml.v3"
)

// ParseRuleBundle parses Semgrep-subset YAML into rules.
// Invalid YAML returns an actionable error naming sourceName.
func ParseRuleBundle(yamlContent, sourceName, source string) ([]Rule, error) {
	dec := yaml.NewDecoder(strings.NewReader(yamlContent))
	var rules []Rule
	docIndex := 0
	for {
		var doc map[string]any
		err := dec.Decode(&doc)
		if err != nil {
			if err == io.EOF {
				break
			}
			return nil, fmt.Errorf("invalid secret rules YAML in %s: %w", sourceName, err)
		}
		docIndex++
		if doc == nil {
			continue
		}
		rawRules, ok := doc["rules"]
		if !ok {
			continue
		}
		list, ok := asList(rawRules)
		if !ok {
			return nil, fmt.Errorf("invalid secret rules YAML in %s (document %d): rules must be a list", sourceName, docIndex)
		}
		for i, raw := range list {
			rule, err := parseRuleObject(raw, sourceName, source)
			if err != nil {
				return nil, fmt.Errorf("invalid secret rule #%d in %s: %w", i+1, sourceName, err)
			}
			if rule != nil {
				rules = append(rules, *rule)
			}
		}
	}
	return rules, nil
}

func parseRuleObject(raw any, sourceName, source string) (*Rule, error) {
	ruleMap, ok := asMap(raw)
	if !ok {
		return nil, nil
	}
	id := strings.TrimSpace(asString(ruleMap["id"]))
	message := strings.TrimSpace(asString(ruleMap["message"]))
	if id == "" || message == "" {
		return nil, nil
	}

	metadata, _ := asMap(ruleMap["metadata"])
	if metadata == nil {
		metadata = map[string]any{}
	}
	caseInsensitive := ruleCaseInsensitive(ruleMap, metadata)
	patterns := collectPatterns(ruleMap, caseInsensitive)
	if len(patterns) == 0 {
		return nil, nil
	}

	for _, p := range patterns {
		if p.Kind != PatternRegex {
			continue
		}
		expr := p.Value
		if p.CaseInsensitive {
			expr = "(?i)" + expr
		}
		if _, err := regexp.Compile(expr); err != nil {
			return nil, fmt.Errorf("invalid regex in secret rule %s: %v", id, err)
		}
	}

	sev, ok := findings.MapRuleSeverity(asString(ruleMap["severity"]))
	if !ok {
		sev = findings.SeverityMedium
	}

	desc := asString(ruleMap["description"])
	if desc == "" {
		desc = id
	}

	remediation := asString(metadata["remediation"])
	if remediation == "" {
		remediation = asString(metadata["remediation-guidance"])
	}

	return &Rule{
		ID:          id,
		Description: desc,
		Message:     message,
		Severity:    sev,
		Confidence:  normalizeConfidence(metadata["confidence"]),
		Remediation: remediation,
		Patterns:    patterns,
		Source:      source,
		SourceName:  sourceName,
	}, nil
}

func asString(v any) string {
	s, _ := v.(string)
	return s
}

func asMap(v any) (map[string]any, bool) {
	m, ok := v.(map[string]any)
	return m, ok
}

func asList(v any) ([]any, bool) {
	list, ok := v.([]any)
	return list, ok
}

func normalizeConfidence(value any) findings.Confidence {
	s := strings.ToLower(strings.TrimSpace(asString(value)))
	switch s {
	case "low":
		return findings.ConfidenceLow
	case "high":
		return findings.ConfidenceHigh
	case "medium":
		return findings.ConfidenceMedium
	default:
		return findings.ConfidenceMedium
	}
}

func parseCaseInsensitiveFlag(value any) bool {
	switch v := value.(type) {
	case bool:
		return v
	case string:
		return strings.EqualFold(v, "true")
	default:
		return false
	}
}

func ruleCaseInsensitive(rule, metadata map[string]any) bool {
	options, ok := asMap(rule["options"])
	if ok {
		if parseCaseInsensitiveFlag(options["generic_caseless"]) {
			return true
		}
		if cs, exists := options["case_sensitive"]; exists && cs == false {
			return true
		}
	}
	return parseCaseInsensitiveFlag(metadata["case-insensitive"]) ||
		parseCaseInsensitiveFlag(metadata["case_insensitive"])
}

func collectPatterns(node any, caseInsensitive bool) []Pattern {
	entry, ok := asMap(node)
	if !ok || entry == nil {
		return nil
	}
	var patterns []Pattern
	if s := asString(entry["pattern-regex"]); s != "" {
		patterns = append(patterns, Pattern{
			Kind:            PatternRegex,
			Value:           s,
			CaseInsensitive: caseInsensitive,
		})
	}
	if s := asString(entry["pattern"]); s != "" {
		patterns = append(patterns, Pattern{
			Kind:  PatternLiteral,
			Value: s,
		})
	}
	if list, ok := asList(entry["patterns"]); ok {
		for _, child := range list {
			patterns = append(patterns, collectPatterns(child, caseInsensitive)...)
		}
	}
	if list, ok := asList(entry["pattern-either"]); ok {
		for _, child := range list {
			patterns = append(patterns, collectPatterns(child, caseInsensitive)...)
		}
	}
	return patterns
}
