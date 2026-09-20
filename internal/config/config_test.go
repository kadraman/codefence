package config

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"
)

func TestParseYAML_ExampleFile(t *testing.T) {
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	root := filepath.Clean(filepath.Join(filepath.Dir(thisFile), "..", ".."))
	data, err := os.ReadFile(filepath.Join(root, "examples", "codefence-config.yml.example"))
	if err != nil {
		t.Fatalf("read example: %v", err)
	}
	cfg, err := ParseYAML(data)
	if err != nil {
		t.Fatalf("ParseYAML example: %v", err)
	}
	if got := len(cfg.Aspects); got != 1 || cfg.Aspects[0] != "code" {
		t.Fatalf("aspects: %#v", cfg.Aspects)
	}
	if cfg.Format != "table" {
		t.Fatalf("format: %q", cfg.Format)
	}
	if cfg.Deps.Provider != "osv" || cfg.Deps.Scope != "changed" {
		t.Fatalf("deps: %+v", cfg.Deps)
	}
	if cfg.Deps.CacheTTL != 24*time.Hour || cfg.Deps.Timeout != 15*time.Second {
		t.Fatalf("deps durations: ttl=%v timeout=%v", cfg.Deps.CacheTTL, cfg.Deps.Timeout)
	}
	if cfg.Secret.DefaultRules != "on" || cfg.Secret.MinConfidence != "low" {
		t.Fatalf("secret: %+v", cfg.Secret)
	}
	if cfg.Secret.EntropyThreshold != 4.2 || cfg.Secret.MinLength != 12 {
		t.Fatalf("secret thresholds: %+v", cfg.Secret)
	}
}

func TestLoadFile_MissingUsesNotFound(t *testing.T) {
	dir := t.TempDir()
	_, found, err := LoadFile(dir)
	if err != nil {
		t.Fatalf("LoadFile: %v", err)
	}
	if found {
		t.Fatal("expected found=false for missing file")
	}
}

func TestLoadFile_InvalidYAML(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, FileName)
	if err := os.WriteFile(path, []byte(":\nbad"), 0o644); err != nil {
		t.Fatal(err)
	}
	_, _, err := LoadFile(dir)
	if err == nil {
		t.Fatal("expected invalid YAML error")
	}
}

func TestLoadFile_UnsupportedVersion(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, FileName)
	if err := os.WriteFile(path, []byte("version: 99\nscan:\n  format: table\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	_, _, err := LoadFile(dir)
	if err == nil {
		t.Fatal("expected unsupported version error")
	}
}

func TestParseYAML_UnknownFieldRejected(t *testing.T) {
	_, err := ParseYAML([]byte("version: 1\nscan:\n  formt: json\n"))
	if err == nil {
		t.Fatal("expected unknown field error for scan.formt")
	}
	_, err = ParseYAML([]byte("version: 1\nformt: json\n"))
	if err == nil {
		t.Fatal("expected unknown top-level field error")
	}
	cfg, err := ParseYAML([]byte("version: 1\nscan:\n  format: json\n"))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Format != "json" {
		t.Fatalf("format: %q", cfg.Format)
	}
}

func TestLoadFile_CwdOnly(t *testing.T) {
	parent := t.TempDir()
	child := filepath.Join(parent, "sub")
	if err := os.Mkdir(child, 0o755); err != nil {
		t.Fatal(err)
	}
	parentCfg := []byte("version: 1\nscan:\n  format: json\n")
	if err := os.WriteFile(filepath.Join(parent, FileName), parentCfg, 0o644); err != nil {
		t.Fatal(err)
	}
	_, found, err := LoadFile(child)
	if err != nil {
		t.Fatal(err)
	}
	if found {
		t.Fatal("must not walk upward to parent config")
	}
}

func TestParseBoolEnv(t *testing.T) {
	truthy := []string{"1", "true", "TRUE", "on", "Yes"}
	for _, v := range truthy {
		b, err := parseBoolEnv(v)
		if err != nil || !b {
			t.Fatalf("truthy %q: got %v %v", v, b, err)
		}
	}
	falsey := []string{"0", "false", "off", "no"}
	for _, v := range falsey {
		b, err := parseBoolEnv(v)
		if err != nil || b {
			t.Fatalf("falsey %q: got %v %v", v, b, err)
		}
	}
	if _, err := parseBoolEnv("maybe"); err == nil {
		t.Fatal("expected error for invalid bool")
	}
}

func TestMerge_PrecedenceFlagBeatsEnvBeatsFile(t *testing.T) {
	fileYAML := []byte(`
version: 1
scan:
  format: table
  quiet: false
deps:
  scope: changed
  provider: osv
secret:
  min_confidence: low
  min_length: 12
`)
	fileCfg, err := ParseYAML(fileYAML)
	if err != nil {
		t.Fatal(err)
	}

	env := mapEnv{
		"CODEFENCE_FORMAT":               "json",
		"CODEFENCE_QUIET":                "1",
		"CODEFENCE_DEPS_SCOPE":           "tree",
		"CODEFENCE_SECRET_MIN_CONFIDENCE": "medium",
		"CODEFENCE_SECRET_MIN_LENGTH":    "20",
	}
	envOverlay, err := parseEnv(env)
	if err != nil {
		t.Fatal(err)
	}

	flags := Flags{
		Format:                "table",
		SetFormat:             true,
		DepsScope:             "changed",
		SetDepsScope:          true,
		SecretMinConfidence:   "high",
		SetSecretMinConfidence: true,
	}

	cfg := Merge(Builtins(), fileCfg, true, envOverlay, flags)

	if cfg.Format != "table" {
		t.Fatalf("flag should win format: %q", cfg.Format)
	}
	if !cfg.Quiet {
		t.Fatal("env quiet should apply (no flag)")
	}
	if cfg.Deps.Scope != "changed" {
		t.Fatalf("flag should win deps scope: %q", cfg.Deps.Scope)
	}
	if cfg.Secret.MinConfidence != "high" {
		t.Fatalf("flag should win min_confidence: %q", cfg.Secret.MinConfidence)
	}
	if cfg.Secret.MinLength != 20 {
		t.Fatalf("env should win min_length over file: %d", cfg.Secret.MinLength)
	}
}

func TestMerge_FileBeatsBuiltins(t *testing.T) {
	fileYAML := []byte(`
version: 1
scan:
  aspects: [code, deps]
  format: json
paths:
  git_ignored_prefixes: [examples/]
deps:
  timeout: 30s
secret:
  entropy_threshold: 5.0
`)
	fileCfg, err := ParseYAML(fileYAML)
	if err != nil {
		t.Fatal(err)
	}
	cfg := Merge(Builtins(), fileCfg, true, EnvOverlay{}, Flags{})
	if cfg.Format != "json" {
		t.Fatalf("format: %q", cfg.Format)
	}
	if len(cfg.Aspects) != 2 {
		t.Fatalf("aspects: %#v", cfg.Aspects)
	}
	if len(cfg.GitIgnoredPrefixes) != 1 || cfg.GitIgnoredPrefixes[0] != "examples/" {
		t.Fatalf("prefixes: %#v", cfg.GitIgnoredPrefixes)
	}
	if cfg.Deps.Timeout != 30*time.Second {
		t.Fatalf("timeout: %v", cfg.Deps.Timeout)
	}
	if cfg.Secret.EntropyThreshold != 5.0 {
		t.Fatalf("entropy: %v", cfg.Secret.EntropyThreshold)
	}
}

func TestMerge_MissingFileUsesBuiltins(t *testing.T) {
	cfg := Merge(Builtins(), Config{}, false, EnvOverlay{}, Flags{})
	b := Builtins()
	if cfg.Format != b.Format || cfg.Deps.Scope != b.Deps.Scope {
		t.Fatalf("got %+v want builtins", cfg)
	}
}

func TestResolve_Integration(t *testing.T) {
	dir := t.TempDir()
	data := []byte("version: 1\nscan:\n  format: json\n")
	if err := os.WriteFile(filepath.Join(dir, FileName), data, 0o644); err != nil {
		t.Fatal(err)
	}
	t.Setenv("CODEFENCE_FORMAT", "table")
	cfg, err := Resolve(dir, Flags{})
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Format != "table" {
		t.Fatalf("env should override file format: %q", cfg.Format)
	}
	cfg2, err := Resolve(dir, Flags{Format: "json", SetFormat: true})
	if err != nil {
		t.Fatal(err)
	}
	if cfg2.Format != "json" {
		t.Fatalf("flag should override env: %q", cfg2.Format)
	}
}
