package secret

import (
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"
)

func TestCacheFreshnessHonorsCurrentTTL(t *testing.T) {
	dir := t.TempDir()
	url := "http://127.0.0.1:9/rules.yml"
	twoHoursAgo := time.Now().Add(-2 * time.Hour)
	_, err := WriteCachedSecretRules(dir, url, "rules:\n  - id: x\n    message: m\n    pattern-regex: 'x'\n", 24*time.Hour, twoHoursAgo)
	if err != nil {
		t.Fatal(err)
	}
	cached, err := ReadCachedSecretRules(dir, url)
	if err != nil || cached == nil {
		t.Fatalf("cached=%v err=%v", cached, err)
	}
	if !IsSecretRulesCacheFresh(cached, 24*time.Hour, time.Now()) {
		t.Fatal("expected fresh under 24h TTL")
	}
	if IsSecretRulesCacheFresh(cached, time.Hour, time.Now()) {
		t.Fatal("expected stale under 1h TTL")
	}
}

func TestRemoteFetchAndCacheFallback(t *testing.T) {
	ClearProcessCache()
	t.Cleanup(ClearProcessCache)

	yamlBody := `rules:
  - id: remote-secret
    message: Remote secret detected
    severity: high
    metadata:
      confidence: medium
    pattern-regex: "\\bremote_[A-Za-z0-9]{12}\\b"
`
	requests := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		w.Header().Set("Content-Type", "application/x-yaml")
		_, _ = w.Write([]byte(yamlBody))
	}))
	defer srv.Close()

	workspace := t.TempDir()
	opts := Options{
		DefaultRules:     "off",
		RulesUpdateURL:   srv.URL + "/rules.yml",
		RulesCacheTTL:    time.Minute,
		EntropyThreshold: 4.2,
		MinLength:        12,
		MinConfidence:    "low",
	}

	first, err := LoadRules(workspace, opts)
	if err != nil {
		t.Fatal(err)
	}
	if len(first) != 1 || first[0].ID != "remote-secret" {
		t.Fatalf("%+v", first)
	}
	if requests != 1 {
		t.Fatalf("requests=%d", requests)
	}

	srv.Close()

	second, err := LoadRules(workspace, opts)
	if err != nil {
		t.Fatal(err)
	}
	if len(second) != 1 || second[0].ID != "remote-secret" {
		t.Fatalf("%+v", second)
	}
	if requests != 1 {
		t.Fatalf("should not re-fetch while fresh: requests=%d", requests)
	}
}

func TestRemoteRefreshForcesFetch(t *testing.T) {
	ClearProcessCache()
	t.Cleanup(ClearProcessCache)

	yamlBody := `rules:
  - id: remote-secret
    message: Remote secret detected
    severity: high
    metadata:
      confidence: medium
    pattern-regex: "\\bremote_[A-Za-z0-9]{12}\\b"
`
	requests := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		_, _ = w.Write([]byte(yamlBody))
	}))
	t.Cleanup(srv.Close)

	workspace := t.TempDir()
	opts := Options{
		DefaultRules:   "off",
		RulesUpdateURL: srv.URL + "/rules.yml",
		RulesCacheTTL:  time.Hour,
	}
	if _, err := LoadRules(workspace, opts); err != nil {
		t.Fatal(err)
	}
	if requests != 1 {
		t.Fatalf("requests=%d", requests)
	}
	opts.RulesRefresh = true
	if _, err := LoadRules(workspace, opts); err != nil {
		t.Fatal(err)
	}
	if requests != 2 {
		t.Fatalf("refresh should re-fetch: requests=%d", requests)
	}
}

func TestCacheRejectsTamperedChecksum(t *testing.T) {
	dir := t.TempDir()
	url := "http://127.0.0.1:9/rules.yml"
	entry, err := WriteCachedSecretRules(dir, url, "body-a", time.Hour, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	path := cacheFilePath(dir, url)
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	tampered := strings.Replace(string(data), entry.Body, "body-b", 1)
	if err := os.WriteFile(path, []byte(tampered), 0o644); err != nil {
		t.Fatal(err)
	}
	got, err := ReadCachedSecretRules(dir, url)
	if err != nil {
		t.Fatal(err)
	}
	if got != nil {
		t.Fatalf("expected nil on checksum mismatch, got %+v", got)
	}
}

func TestRejectNonLocalHTTP(t *testing.T) {
	u := "http" + "://" + "example.com/rules.yml"
	err := validateRulesURL(u)
	if err == nil {
		t.Fatal("expected error for non-local http")
	}
}
