package code

import (
	"path/filepath"
	"strings"
)

// Source and config-like extensions from 006 File filter (v1). Case-insensitive.
var scannableExt = map[string]bool{
	".js": true, ".jsx": true, ".mjs": true, ".cjs": true,
	".ts": true, ".tsx": true, ".mts": true, ".cts": true,
	".go": true, ".py": true,
	".yml": true, ".yaml": true, ".json": true, ".toml": true,
	".env": true, ".ini": true, ".cfg": true, ".conf": true,
}

// Config-like basenames from 006 File filter (v1). Compared case-insensitively.
var scannableBase = map[string]bool{
	"dockerfile": true,
	"makefile":   true,
	".env":       true,
}

// Heavy dirs from 006 File filter (v1); same names as feature 005 tree discovery.
var heavyDirNames = map[string]bool{
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

// IsScannable reports whether path is a source or config-like file and is not under a heavy dir.
// Binary detection happens when the file is read (NUL in contents).
func IsScannable(path string) bool {
	if HasHeavyDir(path) {
		return false
	}
	base := strings.ToLower(filepath.Base(path))
	if scannableBase[base] {
		return true
	}
	ext := strings.ToLower(filepath.Ext(path))
	return scannableExt[ext]
}

// HasHeavyDir reports whether any path component is a v1 heavy dir.
func HasHeavyDir(path string) bool {
	norm := filepath.ToSlash(path)
	for _, part := range strings.Split(norm, "/") {
		if heavyDirNames[part] {
			return true
		}
	}
	return false
}

// FilterScannable returns the subset of paths that pass IsScannable, preserving order.
func FilterScannable(paths []string) []string {
	out := make([]string, 0, len(paths))
	for _, p := range paths {
		if IsScannable(p) {
			out = append(out, p)
		}
	}
	return out
}
