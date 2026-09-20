package cache

import (
	"path/filepath"
	"testing"
)

func TestPathHelpers(t *testing.T) {
	root := filepath.FromSlash("/repo")
	if got, want := Dir(root), filepath.Join(root, ".codefence"); got != want {
		t.Fatalf("Dir: got %q want %q", got, want)
	}
	if got, want := CacheCode(root), filepath.Join(root, ".codefence", "cache", "code"); got != want {
		t.Fatalf("CacheCode: got %q want %q", got, want)
	}
	if got, want := CacheDeps(root), filepath.Join(root, ".codefence", "cache", "deps"); got != want {
		t.Fatalf("CacheDeps: got %q want %q", got, want)
	}
	if got, want := CacheSecretRules(root), filepath.Join(root, ".codefence", "cache", "secret-rules"); got != want {
		t.Fatalf("CacheSecretRules: got %q want %q", got, want)
	}
	if got, want := DebouncePath(root), filepath.Join(root, ".codefence", "debounce.json"); got != want {
		t.Fatalf("DebouncePath: got %q want %q", got, want)
	}
}
