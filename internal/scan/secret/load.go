package secret

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// LoadRules loads builtin (optional), local --secret-rules paths, and remote URL packs.
// Regexes are compiled once on the returned set.
func LoadRules(workspace string, opts Options) ([]Rule, error) {
	opts = opts.Normalize()
	var loaded []Rule

	if opts.DefaultRulesOn() {
		if opts.DefaultRulesVersion != "" && opts.DefaultRulesVersion != BuiltinRulesVersion {
			return nil, fmt.Errorf(
				"unknown built-in secret rule version: %s (available: %s)",
				opts.DefaultRulesVersion, BuiltinRulesVersion,
			)
		}
		builtin, err := loadBuiltinRules()
		if err != nil {
			return nil, err
		}
		loaded = append(loaded, builtin...)
	}

	if len(opts.RulePaths) > 0 {
		custom, err := loadRulesFromPaths(opts.RulePaths, workspace)
		if err != nil {
			return nil, err
		}
		loaded = append(loaded, custom...)
	}

	if opts.RulesUpdateURL != "" {
		body, err := LoadRemoteRuleBundle(workspace, opts.RulesUpdateURL, opts.RulesCacheTTL, opts.RulesRefresh)
		if err != nil {
			return nil, err
		}
		remote, err := ParseRuleBundle(body, opts.RulesUpdateURL, SourceRemote)
		if err != nil {
			return nil, err
		}
		loaded = append(loaded, remote...)
	}

	loaded = dedupeRules(loaded)
	if err := CompileRules(loaded); err != nil {
		return nil, err
	}
	return loaded, nil
}

func loadBuiltinRules() ([]Rule, error) {
	sourceName := "builtin@" + BuiltinRulesVersion
	rules, err := ParseRuleBundle(string(BuiltinYAML()), sourceName, SourceBuiltin)
	if err != nil {
		return nil, err
	}
	if len(rules) == 0 {
		return nil, fmt.Errorf("built-in secret rules bundle is empty")
	}
	return rules, nil
}

func loadRulesFromPaths(rulePaths []string, workspace string) ([]Rule, error) {
	var yamlFiles []string
	for _, raw := range rulePaths {
		absolute := raw
		if !filepath.IsAbs(raw) {
			absolute = filepath.Join(workspace, raw)
		}
		if _, err := os.Stat(absolute); err != nil {
			return nil, fmt.Errorf("secret rule path not found: %s", raw)
		}
		if err := collectYAMLFiles(absolute, &yamlFiles); err != nil {
			return nil, err
		}
	}
	sort.Strings(yamlFiles)

	var loaded []Rule
	for _, filePath := range yamlFiles {
		data, err := os.ReadFile(filePath)
		if err != nil {
			return nil, fmt.Errorf("read secret rules %s: %w", filePath, err)
		}
		rules, err := ParseRuleBundle(string(data), filePath, SourceCustom)
		if err != nil {
			return nil, err
		}
		loaded = append(loaded, rules...)
	}
	return loaded, nil
}

func collectYAMLFiles(entryPath string, out *[]string) error {
	info, err := os.Stat(entryPath)
	if err != nil {
		return err
	}
	if !info.IsDir() {
		if isYAMLFile(entryPath) {
			*out = append(*out, entryPath)
		}
		return nil
	}
	entries, err := os.ReadDir(entryPath)
	if err != nil {
		return err
	}
	for _, e := range entries {
		if err := collectYAMLFiles(filepath.Join(entryPath, e.Name()), out); err != nil {
			return err
		}
	}
	return nil
}

func isYAMLFile(path string) bool {
	ext := strings.ToLower(filepath.Ext(path))
	return ext == ".yml" || ext == ".yaml"
}

func dedupeRules(rules []Rule) []Rule {
	seen := make(map[string]struct{}, len(rules))
	out := make([]Rule, 0, len(rules))
	for _, rule := range rules {
		key := rule.ID + ":" + rule.SourceName
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, rule)
	}
	return out
}
