package secret

import (
	"strings"

	"github.com/kadraman/codefence/internal/findings"
)

// ConfidenceWeight ranks confidence for filtering and merge.
func ConfidenceWeight(c findings.Confidence) int {
	switch strings.ToLower(string(c)) {
	case "high":
		return 3
	case "medium":
		return 2
	default:
		return 1
	}
}

// FilterByMinConfidence drops secret findings below the configured floor.
func FilterByMinConfidence(in []findings.Finding, minConfidence string) []findings.Finding {
	min := findings.Confidence(strings.ToLower(strings.TrimSpace(minConfidence)))
	if min == "" {
		min = findings.ConfidenceLow
	}
	floor := ConfidenceWeight(min)
	out := make([]findings.Finding, 0, len(in))
	for _, f := range in {
		if f.Kind == findings.KindSecret {
			conf := f.Confidence
			if conf == "" {
				conf = findings.ConfidenceLow
			}
			if ConfidenceWeight(conf) < floor {
				continue
			}
		}
		out = append(out, f)
	}
	return out
}
