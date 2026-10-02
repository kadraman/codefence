package secret

import (
	"path/filepath"
	"strings"

	"github.com/kadraman/codefence/internal/findings"
)

// ScanContent runs rule matching, entropy, merge, and confidence filtering on one file.
// Pass preloaded rules to avoid reloading per file (parse once per scan).
func ScanContent(filePath, content string, opts Options, rules []Rule) ([]findings.Finding, error) {
	opts = opts.Normalize()
	var err error
	if rules == nil {
		// Caller should preload; keep a safe path for unit tests.
		rules, err = LoadRulesCached("", opts)
		if err != nil {
			return nil, err
		}
	}
	lines := splitLines(content)
	ruleFindings := MatchRules(filePath, lines, rules)
	entropyFindings := FindEntropySecrets(filePath, lines, opts)
	merged := MergeFindings(append(ruleFindings, entropyFindings...))
	filtered := FilterByMinConfidence(merged, opts.MinConfidence)
	for i := range filtered {
		filtered[i].Evidence = TruncateEvidence(filtered[i].Evidence, DefaultEvidenceMax)
	}
	return filtered, nil
}

// ScanFiles loads rules once, then scans each file under cwd.
func ScanFiles(cwd string, files []string, opts Options) ([]findings.Finding, error) {
	opts = opts.Normalize()
	rules, err := LoadRulesCached(cwd, opts)
	if err != nil {
		return nil, err
	}
	var out []findings.Finding
	for _, rel := range files {
		abs := rel
		if cwd != "" && !filepath.IsAbs(rel) {
			abs = filepath.Join(cwd, rel)
		}
		data, err := readTextFile(abs)
		if err != nil {
			return nil, err
		}
		if data == nil {
			continue // binary / empty skip marker
		}
		hits, err := ScanContent(filepath.ToSlash(rel), string(data), opts, rules)
		if err != nil {
			return nil, err
		}
		out = append(out, hits...)
	}
	return out, nil
}

func splitLines(content string) []string {
	content = strings.ReplaceAll(content, "\r\n", "\n")
	content = strings.ReplaceAll(content, "\r", "\n")
	return strings.Split(content, "\n")
}
