// Package cache defines local state path contracts under .codefence/.
// Writers live in scan/deps/secret packages; this package exports path helpers.
package cache

import "path/filepath"

const (
	// RootDir is the repository-local Codefence state directory.
	RootDir = ".codefence"

	// DebounceFile is the background-scan debounce state file (feature 010).
	DebounceFile = "debounce.json"
)

// Dir returns <root>/.codefence.
func Dir(root string) string {
	return filepath.Join(root, RootDir)
}

// CacheCode returns <root>/.codefence/cache/code.
func CacheCode(root string) string {
	return filepath.Join(root, RootDir, "cache", "code")
}

// CacheDeps returns <root>/.codefence/cache/deps.
func CacheDeps(root string) string {
	return filepath.Join(root, RootDir, "cache", "deps")
}

// CacheSecretRules returns <root>/.codefence/cache/secret-rules.
func CacheSecretRules(root string) string {
	return filepath.Join(root, RootDir, "cache", "secret-rules")
}

// DebouncePath returns <root>/.codefence/debounce.json.
func DebouncePath(root string) string {
	return filepath.Join(root, RootDir, DebounceFile)
}
