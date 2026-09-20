package deps_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/kadraman/codefence/internal/scan/deps"
)

func TestDiscoverManifests_SkipsVendorDirs(t *testing.T) {
	root := t.TempDir()
	mustWrite := func(rel string) {
		p := filepath.Join(root, rel)
		if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(p, []byte("x"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	mustWrite("go.mod")
	mustWrite("node_modules/pkg/package.json")
	mustWrite(".venv/lib/requirements.txt")
	mustWrite("venv/lib/requirements.txt")
	mustWrite("__pycache__/x/requirements.txt")
	mustWrite(".codefence/cache/deps/go.mod")
	mustWrite("src/package-lock.json")

	got, err := deps.DiscoverManifests(root, []string{"."})
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]bool{"go.mod": true, "src/package-lock.json": true}
	if len(got) != 2 {
		t.Fatalf("got %#v", got)
	}
	for _, g := range got {
		if !want[filepath.ToSlash(g)] {
			t.Fatalf("unexpected %q in %#v", g, got)
		}
	}
}

func TestShouldSkipDir(t *testing.T) {
	for _, n := range []string{"node_modules", ".venv", "venv", "__pycache__", ".git", ".codefence"} {
		if !deps.ShouldSkipDir(n) {
			t.Fatalf("expected skip %q", n)
		}
	}
}
