package deps

import (
	"path/filepath"
)

// MVP manifest / trigger basenames (feature 008 matrix; discovery only here).
var manifestBasenames = map[string]bool{
	"package.json":      true,
	"package-lock.json": true,
	"yarn.lock":         true,
	"pnpm-lock.yaml":    true,
	"go.mod":            true,
	"go.sum":            true,
	"requirements.txt":  true,
	"Pipfile":           true,
	"Pipfile.lock":      true,
	"pyproject.toml":    true,
	"poetry.lock":       true,
	"uv.lock":           true,
}

// IsManifest reports whether path is an MVP dependency manifest or trigger file.
func IsManifest(path string) bool {
	return manifestBasenames[filepath.Base(path)]
}
