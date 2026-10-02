package secret

import (
	"fmt"
	"math"
	"regexp"
	"strings"

	"github.com/kadraman/codefence/internal/findings"
)

var genericAssignmentRE = regexp.MustCompile(
	`\b([A-Za-z_][A-Za-z0-9_-]{1,64})\b\s*[:=]\s*["']([^"'\\\n]{1,})["']`,
)

var benignAssignmentKeys = map[string]struct{}{
	"name": {}, "version": {}, "path": {}, "url": {}, "host": {}, "port": {},
	"image": {}, "sha": {}, "digest": {}, "color": {},
	// Package-manager / lockfile metadata — high entropy but not secrets.
	"source": {}, "checksum": {}, "hash": {}, "integrity": {}, "registry": {}, "resolved": {},
}

// Path-only registry/URL values (no userinfo, query, or fragment).
var benignValuePatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)^https?://[^?#@]+$`),
	regexp.MustCompile(`(?i)^registry\+https?://[^?#@]+$`),
	regexp.MustCompile(`(?i)^git\+https?://[^?#@]+$`),
	regexp.MustCompile(`(?i)^ssh://[^?#@]+$`),
}

func isBenignAssignmentValue(value string) bool {
	for _, p := range benignValuePatterns {
		if p.MatchString(value) {
			return true
		}
	}
	return false
}

// ShannonEntropy returns Shannon entropy in bits per character.
func ShannonEntropy(input string) float64 {
	if len(input) == 0 {
		return 0
	}
	counts := make(map[rune]int, len(input))
	for _, r := range input {
		counts[r]++
	}
	n := float64(len(input))
	var entropy float64
	for _, c := range counts {
		p := float64(c) / n
		entropy -= p * math.Log2(p)
	}
	return entropy
}

func inferEntropyConfidence(entropy, threshold float64) findings.Confidence {
	if entropy >= threshold+0.6 {
		return findings.ConfidenceHigh
	}
	if entropy >= threshold {
		return findings.ConfidenceMedium
	}
	return findings.ConfidenceLow
}

// FindEntropySecrets scans assignment-like candidates for high Shannon entropy.
func FindEntropySecrets(filePath string, lines []string, opts Options) []findings.Finding {
	opts = opts.Normalize()
	var out []findings.Finding
	for lineIdx, line := range lines {
		matches := genericAssignmentRE.FindAllStringSubmatch(line, -1)
		for _, match := range matches {
			if len(match) < 3 {
				continue
			}
			key := strings.ToLower(strings.TrimSpace(match[1]))
			value := strings.TrimSpace(match[2])
			if value == "" || len(value) < opts.MinLength {
				continue
			}
			if _, skip := benignAssignmentKeys[key]; skip {
				continue
			}
			if isBenignAssignmentValue(value) {
				continue
			}
			entropy := ShannonEntropy(value)
			if entropy < opts.EntropyThreshold {
				continue
			}
			out = append(out, findings.Finding{
				RuleID:          RuleHighEntropy,
				Message:         "Potential hardcoded secret detected via entropy heuristic",
				FilePath:        filePath,
				Line:            lineIdx + 1,
				Severity:        findings.EntropySeverity(entropy, opts.EntropyThreshold),
				Confidence:      inferEntropyConfidence(entropy, opts.EntropyThreshold),
				Evidence:        fmt.Sprintf("token-like string length=%d entropy=%.2f", len(value), entropy),
				Remediation:     "Move secret-like values into environment variables or a secret manager.",
				Kind:            findings.KindSecret,
				DetectionMethod: findings.DetectionEntropy,
			})
		}
	}
	return out
}
