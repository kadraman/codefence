package scan

import (
	"path/filepath"
	"strings"

	"github.com/kadraman/codefence/internal/scan/deps"
)

// IsManifest reports whether path is an MVP dependency manifest or trigger file.
func IsManifest(path string) bool {
	return deps.IsManifest(path)
}

// HasManifestInScope reports whether any path in files is a manifest.
func HasManifestInScope(files []string) bool {
	for _, f := range files {
		if IsManifest(f) {
			return true
		}
	}
	return false
}

// filterIgnoredPrefixes drops paths that match any prefix (git-based scans only).
func filterIgnoredPrefixes(files, prefixes []string) []string {
	if len(prefixes) == 0 {
		return files
	}
	out := make([]string, 0, len(files))
	for _, f := range files {
		if matchesPrefix(f, prefixes) {
			continue
		}
		out = append(out, f)
	}
	return out
}

func matchesPrefix(path string, prefixes []string) bool {
	norm := filepath.ToSlash(path)
	for _, p := range prefixes {
		p = filepath.ToSlash(p)
		if p == "" {
			continue
		}
		if strings.HasPrefix(norm, p) {
			return true
		}
	}
	return false
}
