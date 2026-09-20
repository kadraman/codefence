package findings

import "strings"

// MapRuleSeverity maps YAML/Semgrep severity labels to Finding severities.
// Pass-through for critical|high|medium|low; ERROR→critical, WARNING→medium, INFO→low.
func MapRuleSeverity(raw string) (Severity, bool) {
	switch strings.ToUpper(strings.TrimSpace(raw)) {
	case "CRITICAL":
		return SeverityCritical, true
	case "HIGH":
		return SeverityHigh, true
	case "MEDIUM":
		return SeverityMedium, true
	case "LOW":
		return SeverityLow, true
	case "ERROR":
		return SeverityCritical, true
	case "WARNING":
		return SeverityMedium, true
	case "INFO":
		return SeverityLow, true
	default:
		// Also accept lowercase forms already handled by ToUpper for known set.
		switch strings.ToLower(strings.TrimSpace(raw)) {
		case "critical":
			return SeverityCritical, true
		case "high":
			return SeverityHigh, true
		case "medium":
			return SeverityMedium, true
		case "low":
			return SeverityLow, true
		default:
			return "", false
		}
	}
}

// EntropySeverity maps entropy-only detections relative to threshold T:
// ≥ T+1.0 → critical; ≥ T+0.6 → high; else medium.
func EntropySeverity(entropy, threshold float64) Severity {
	if entropy >= threshold+1.0 {
		return SeverityCritical
	}
	if entropy >= threshold+0.6 {
		return SeverityHigh
	}
	return SeverityMedium
}
