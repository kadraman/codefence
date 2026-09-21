package code

import (
	"testing"

	"github.com/kadraman/codefence/internal/scan/deps"
)

func TestIsScannable_ExtensionsAndBasenames(t *testing.T) {
	yes := []string{
		"src/app.js", "a.jsx", "b.mjs", "c.cjs",
		"x.ts", "x.tsx", "x.mts", "x.cts",
		"main.go", "app.py",
		"cfg.yml", "cfg.yaml", "pkg.json", "py.toml",
		"secrets.env", "app.ini", "app.cfg", "nginx.conf",
		"Dockerfile", "Makefile", "makefile", ".env",
		"SRC/APP.JS", "MAKEFILE",
	}
	for _, p := range yes {
		if !IsScannable(p) {
			t.Fatalf("want scannable %q", p)
		}
	}
	no := []string{
		"readme.md", "photo.png", "app.css", "blob.bin",
		"notes.txt", "Cargo.toml.bak",
	}
	for _, p := range no {
		if IsScannable(p) {
			t.Fatalf("want skipped %q", p)
		}
	}
}

func TestIsScannable_HeavyDirs(t *testing.T) {
	skip := []string{
		"node_modules/pkg/index.js",
		"src/vendor/lib.go",
		".venv/lib/app.py",
		"venv/lib/app.py",
		"dist/app.js",
		"build/out.go",
		"target/debug/x.go",
		".git/hooks/pre-commit.py",
		".codefence/cache/x.js",
	}
	for _, p := range skip {
		if IsScannable(p) {
			t.Fatalf("want heavy-dir skip %q", p)
		}
	}
	if !IsScannable("src/my_node_modules/app.js") {
		t.Fatal("component my_node_modules must not skip")
	}
}

func TestHeavyDirsMatch005Discovery(t *testing.T) {
	for name := range heavyDirNames {
		if !deps.ShouldSkipDir(name) {
			t.Fatalf("006 heavy dir %q missing from 005 discovery skip set", name)
		}
	}
}
