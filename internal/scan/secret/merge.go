package secret

import (
	"strconv"
	"strings"

	"github.com/kadraman/codefence/internal/findings"
)

func findingKey(f findings.Finding) string {
	return f.FilePath + ":" + strconv.Itoa(f.Line) + ":" + f.RuleID + ":" + f.Message
}

func locationKey(f findings.Finding) string {
	return f.FilePath + ":" + strconv.Itoa(f.Line)
}

func isRuleBasedSecret(f findings.Finding) bool {
	return f.Kind == findings.KindSecret && f.RuleID != RuleHighEntropy
}

func isEntropySecret(f findings.Finding) bool {
	return f.Kind == findings.KindSecret && f.RuleID == RuleHighEntropy
}

func strongerConfidence(a, b findings.Confidence) findings.Confidence {
	if ConfidenceWeight(a) >= ConfidenceWeight(b) {
		if a == "" {
			return findings.ConfidenceLow
		}
		return a
	}
	if b == "" {
		return findings.ConfidenceLow
	}
	return b
}

func combineEvidence(left, right string) string {
	parts := make([]string, 0, 2)
	if left != "" {
		parts = append(parts, left)
	}
	if right != "" {
		parts = append(parts, right)
	}
	return strings.Join(parts, "; ")
}

func combineSecretFindings(left, right findings.Finding) findings.Finding {
	leftIsEntropy := isEntropySecret(left)
	rightIsEntropy := isEntropySecret(right)
	base, extra := left, right
	if leftIsEntropy && !rightIsEntropy {
		base, extra = right, left
	}

	detection := base.DetectionMethod
	if detection == "" {
		detection = findings.DetectionRule
	}
	if leftIsEntropy != rightIsEntropy {
		detection = findings.DetectionRuleEntropy
	} else if extra.DetectionMethod != "" && extra.DetectionMethod != detection {
		detection = findings.DetectionRuleEntropy
	}

	remediation := base.Remediation
	if remediation == "" {
		remediation = extra.Remediation
	}

	return findings.Finding{
		RuleID:          base.RuleID,
		Message:         base.Message,
		FilePath:        base.FilePath,
		Line:            base.Line,
		Severity:        findings.StrongerSeverity(base.Severity, extra.Severity),
		Confidence:      strongerConfidence(base.Confidence, extra.Confidence),
		Evidence:        combineEvidence(base.Evidence, extra.Evidence),
		Remediation:     remediation,
		Kind:            findings.KindSecret,
		DetectionMethod: detection,
	}
}

func combineRuleWithEntropy(rule, entropy findings.Finding) findings.Finding {
	remediation := rule.Remediation
	if remediation == "" {
		remediation = entropy.Remediation
	}
	return findings.Finding{
		RuleID:          rule.RuleID,
		Message:         rule.Message,
		FilePath:        rule.FilePath,
		Line:            rule.Line,
		Severity:        findings.StrongerSeverity(rule.Severity, entropy.Severity),
		Confidence:      strongerConfidence(rule.Confidence, entropy.Confidence),
		Evidence:        combineEvidence(rule.Evidence, entropy.Evidence),
		Remediation:     remediation,
		Kind:            findings.KindSecret,
		DetectionMethod: findings.DetectionRuleEntropy,
	}
}

// MergeFindings deduplicates and correlates rule vs entropy hits.
// Correlated same-line pairs become detectionMethod rule+entropy.
func MergeFindings(in []findings.Finding) []findings.Finding {
	ruleHitLocations := map[string]struct{}{}
	for _, f := range in {
		if isRuleBasedSecret(f) {
			ruleHitLocations[locationKey(f)] = struct{}{}
		}
	}

	entropyByLocation := map[string]findings.Finding{}
	for _, f := range in {
		if !isEntropySecret(f) {
			continue
		}
		loc := locationKey(f)
		if existing, ok := entropyByLocation[loc]; ok {
			entropyByLocation[loc] = combineSecretFindings(existing, f)
		} else {
			entropyByLocation[loc] = f
		}
	}

	merged := map[string]findings.Finding{}
	order := make([]string, 0, len(in))

	for _, f := range in {
		if isEntropySecret(f) {
			if _, hasRule := ruleHitLocations[locationKey(f)]; hasRule {
				continue
			}
		}

		key := findingKey(f)
		candidate := f
		if existing, ok := merged[key]; ok {
			candidate = combineSecretFindings(existing, candidate)
		} else {
			order = append(order, key)
		}

		if isRuleBasedSecret(candidate) {
			if entropy, ok := entropyByLocation[locationKey(candidate)]; ok {
				candidate = combineRuleWithEntropy(candidate, entropy)
			}
		}
		merged[key] = candidate
	}

	out := make([]findings.Finding, 0, len(order))
	for _, key := range order {
		out = append(out, merged[key])
	}
	return out
}
