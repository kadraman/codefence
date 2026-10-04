package secret

import "fmt"

// DefaultEvidenceMax is the max evidence length before truncation.
const DefaultEvidenceMax = 120

// SummarizeMatch builds evidence that does not include the secret value.
func SummarizeMatch(matchLen int, sourceName string) string {
	return fmt.Sprintf("matched secret pattern (length=%d) via %s", matchLen, sourceName)
}

// TruncateEvidence truncates evidence so full secrets are never written to logs.
func TruncateEvidence(evidence string, maxLen int) string {
	if maxLen <= 0 {
		maxLen = DefaultEvidenceMax
	}
	if len(evidence) <= maxLen {
		return evidence
	}
	if maxLen <= 3 {
		return evidence[:maxLen]
	}
	return evidence[:maxLen-3] + "..."
}
