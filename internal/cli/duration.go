package cli

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

// parseDuration accepts forms like 24h, 30m, 15s (Go duration syntax).
func parseDuration(s string) (time.Duration, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, fmt.Errorf("empty duration")
	}
	d, err := time.ParseDuration(s)
	if err != nil {
		return 0, fmt.Errorf("invalid duration %q (want forms like 24h, 30m, 15s)", s)
	}
	return d, nil
}

func parseFloat(s string) (float64, error) {
	s = strings.TrimSpace(s)
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid number %q", s)
	}
	return v, nil
}

func parseInt(s string) (int, error) {
	s = strings.TrimSpace(s)
	v, err := strconv.Atoi(s)
	if err != nil {
		return 0, fmt.Errorf("invalid integer %q", s)
	}
	return v, nil
}

func parseAspects(s string) ([]string, error) {
	parts := splitCSV(s)
	if len(parts) == 0 {
		return nil, fmt.Errorf("aspects list is empty")
	}
	out := make([]string, 0, len(parts))
	seen := map[string]bool{}
	for _, p := range parts {
		switch p {
		case "code", "deps":
			if !seen[p] {
				seen[p] = true
				out = append(out, p)
			}
		default:
			return nil, fmt.Errorf("unknown aspect %q (want code or deps)", p)
		}
	}
	return out, nil
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
