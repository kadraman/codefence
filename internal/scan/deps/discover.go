package deps

import (
	"io/fs"
	"os"
	"path/filepath"
)

// skipDirNames are vendor-like / heavy directories skipped during tree discovery (FR-005).
var skipDirNames = map[string]bool{
	"node_modules":  true,
	".venv":         true,
	"venv":          true,
	"__pycache__":   true,
	".git":          true,
	".codefence":    true,
	"vendor":        true,
	"dist":          true,
	"build":         true,
	".tox":          true,
	".mypy_cache":   true,
	".pytest_cache": true,
	"target":        true,
	".idea":         true,
	".vscode":       true,
}

// DiscoverManifests walks roots and returns MVP dependency manifest paths (repo-relative to cwd).
func DiscoverManifests(cwd string, roots []string) ([]string, error) {
	if len(roots) == 0 {
		roots = []string{"."}
	}
	seen := map[string]bool{}
	var out []string
	for _, root := range roots {
		abs := root
		if !filepath.IsAbs(root) {
			abs = filepath.Join(cwd, root)
		}
		err := filepath.WalkDir(abs, func(path string, d fs.DirEntry, err error) error {
			if err != nil {
				if os.IsNotExist(err) {
					return nil
				}
				return err
			}
			if d.IsDir() {
				if skipDirNames[d.Name()] {
					return filepath.SkipDir
				}
				return nil
			}
			if !IsManifest(path) {
				return nil
			}
			rel, err := filepath.Rel(cwd, path)
			if err != nil {
				rel = path
			}
			rel = filepath.ToSlash(rel)
			if seen[rel] {
				return nil
			}
			seen[rel] = true
			out = append(out, rel)
			return nil
		})
		if err != nil {
			return nil, err
		}
	}
	return out, nil
}

// ShouldSkipDir reports whether a directory name is skipped (exported for tests).
func ShouldSkipDir(name string) bool {
	return skipDirNames[name]
}
