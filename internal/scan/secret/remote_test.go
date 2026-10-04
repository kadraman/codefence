package secret

import (
	"errors"
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

func TestRemoteInvalidBodyKeepsKnownGoodCache(t *testing.T) {
	goodBody := `rules:
  - id: remote-secret
    message: Remote secret detected
    pattern-regex: "\\bremote_[A-Za-z0-9]{12}\\b"
`
	cases := map[string]string{
		"malformed yaml": "rules: [\n  - id: x\n    message: :\n",
		"bad regex":      "rules:\n  - id: broken\n    message: m\n    pattern-regex: \"(unclosed\"\n",
	}
	for name, badBody := range cases {
		t.Run(name, func(t *testing.T) {
			ClearProcessCache()
			t.Cleanup(ClearProcessCache)

			body := goodBody
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				_, _ = w.Write([]byte(body))
			}))
			t.Cleanup(srv.Close)

			workspace := t.TempDir()
			opts := Options{DefaultRules: "off", RulesUpdateURL: srv.URL + "/rules.yml", RulesCacheTTL: time.Hour}
			if _, err := LoadRules(workspace, opts); err != nil {
				t.Fatal(err)
			}

			body = badBody
			opts.RulesRefresh = true
			rules, err := LoadRules(workspace, opts)
			if err != nil {
				t.Fatalf("invalid body should fall back to known-good cache: %v", err)
			}
			if len(rules) != 1 || rules[0].ID != "remote-secret" {
				t.Fatalf("expected known-good pack, got %+v", rules)
			}
			cached, err := ReadCachedSecretRules(workspace, opts.RulesUpdateURL)
			if err != nil || cached == nil || cached.Body != goodBody {
				t.Fatalf("known-good cache was replaced: cached=%+v err=%v", cached, err)
			}

			srv.Close()
			rules, err = LoadRules(workspace, opts)
			if err != nil {
				t.Fatal(err)
			}
			if len(rules) != 1 || rules[0].ID != "remote-secret" {
				t.Fatalf("offline fallback should use known-good pack: %+v", rules)
			}
		})
	}
}

func TestRemoteFallbackWarns(t *testing.T) {
	goodBody := `rules:
  - id: remote-secret
    message: Remote secret detected
    pattern-regex: "\\bremote_[A-Za-z0-9]{12}\\b"
`
	cases := []struct {
		name   string
		status int
		body   string
		down   bool
		reason string
	}{
		{name: "invalid body", status: http.StatusOK, body: "rules: [\n  - id: x\n", reason: "invalid rule pack"},
		{name: "http error", status: http.StatusServiceUnavailable, reason: "HTTP 503"},
		{name: "network error", down: true, reason: "download failed"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			ClearProcessCache()
			t.Cleanup(ClearProcessCache)

			status, body := http.StatusOK, goodBody
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(status)
				_, _ = w.Write([]byte(body))
			}))
			t.Cleanup(srv.Close)

			const token = "s3cretSig"
			host := strings.TrimPrefix(srv.URL, "http://")
			rulesURL := "http://bob:" + token + "@" + host + "/rules.yml?sig=" + token
			var warnings []string
			opts := Options{
				DefaultRules:   "off",
				RulesUpdateURL: rulesURL,
				RulesCacheTTL:  time.Hour,
				Warn:           func(msg string) { warnings = append(warnings, msg) },
			}
			workspace := t.TempDir()
			if _, err := LoadRules(workspace, opts); err != nil {
				t.Fatal(err)
			}
			if len(warnings) != 0 {
				t.Fatalf("successful fetch should not warn: %v", warnings)
			}

			if tc.down {
				srv.Close()
			} else {
				status, body = tc.status, tc.body
			}
			opts.RulesRefresh = true
			rules, err := LoadRules(workspace, opts)
			if err != nil {
				t.Fatal(err)
			}
			if len(rules) != 1 || rules[0].ID != "remote-secret" {
				t.Fatalf("expected cached pack, got %+v", rules)
			}
			if len(warnings) != 1 {
				t.Fatalf("want 1 warning, got %v", warnings)
			}
			msg := warnings[0]
			if !strings.Contains(msg, "remote@"+host) || !strings.Contains(msg, tc.reason) {
				t.Fatalf("warning %q missing source or reason %q", msg, tc.reason)
			}
			for _, leaked := range []string{token, "bob", "/rules.yml"} {
				if strings.Contains(msg, leaked) {
					t.Fatalf("warning %q leaks %q", msg, leaked)
				}
			}
		})
	}
}

func TestRemoteBundleSizeCap(t *testing.T) {
	goodBody := `rules:
  - id: remote-secret
    message: Remote secret detected
    pattern-regex: "\\bremote_[A-Za-z0-9]{12}\\b"
`
	// Valid YAML of exactly maxBundleBytes; the oversized variant keeps it as its
	// first maxBundleBytes bytes, so truncation would yield a parseable pack.
	atLimit := goodBody + "#" + strings.Repeat("x", maxBundleBytes-len(goodBody)-2) + "\n"
	overLimit := atLimit + "#\n"

	serve := func(t *testing.T, body *string) string {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_, _ = w.Write([]byte(*body))
		}))
		t.Cleanup(srv.Close)
		return srv.URL + "/rules.yml"
	}

	t.Run("at limit accepted", func(t *testing.T) {
		ClearProcessCache()
		t.Cleanup(ClearProcessCache)
		body := atLimit
		rules, err := LoadRules(t.TempDir(), Options{DefaultRules: "off", RulesUpdateURL: serve(t, &body)})
		if err != nil {
			t.Fatal(err)
		}
		if len(rules) != 1 {
			t.Fatalf("%+v", rules)
		}
	})

	t.Run("over limit without cache fails", func(t *testing.T) {
		ClearProcessCache()
		t.Cleanup(ClearProcessCache)
		body := overLimit
		workspace := t.TempDir()
		rulesURL := serve(t, &body)
		_, err := LoadRules(workspace, Options{DefaultRules: "off", RulesUpdateURL: rulesURL})
		if !errors.Is(err, errBundleTooLarge) {
			t.Fatalf("want size error, got %v", err)
		}
		if cached, _ := ReadCachedSecretRules(workspace, rulesURL); cached != nil {
			t.Fatal("oversized body must not be cached")
		}
	})

	t.Run("over limit falls back to cache with warning", func(t *testing.T) {
		ClearProcessCache()
		t.Cleanup(ClearProcessCache)
		body := goodBody
		workspace := t.TempDir()
		var warnings []string
		opts := Options{
			DefaultRules:   "off",
			RulesUpdateURL: serve(t, &body),
			RulesCacheTTL:  time.Hour,
			Warn:           func(msg string) { warnings = append(warnings, msg) },
		}
		if _, err := LoadRules(workspace, opts); err != nil {
			t.Fatal(err)
		}
		body = overLimit
		opts.RulesRefresh = true
		if _, err := LoadRules(workspace, opts); err != nil {
			t.Fatal(err)
		}
		if len(warnings) != 1 || !strings.Contains(warnings[0], "MiB limit") {
			t.Fatalf("warnings=%v", warnings)
		}
		cached, _ := ReadCachedSecretRules(workspace, opts.RulesUpdateURL)
		if cached == nil || cached.Body != goodBody {
			t.Fatal("known-good cache was replaced")
		}
	})
}

func TestRemoteInvalidBodyWithoutCacheFails(t *testing.T) {
	ClearProcessCache()
	t.Cleanup(ClearProcessCache)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("rules: [\n  - id: x\n    message: :\n"))
	}))
	t.Cleanup(srv.Close)

	workspace := t.TempDir()
	opts := Options{DefaultRules: "off", RulesUpdateURL: srv.URL + "/rules.yml", RulesCacheTTL: time.Hour}
	if _, err := LoadRules(workspace, opts); err == nil {
		t.Fatal("expected error for invalid remote bundle with no cache")
	}
	if cached, _ := ReadCachedSecretRules(workspace, opts.RulesUpdateURL); cached != nil {
		t.Fatalf("invalid body must not be cached: %+v", cached)
	}
}

func TestRemoteIgnoresPoisonedCacheEntry(t *testing.T) {
	ClearProcessCache()
	t.Cleanup(ClearProcessCache)

	goodBody := `rules:
  - id: remote-secret
    message: Remote secret detected
    pattern-regex: "\\bremote_[A-Za-z0-9]{12}\\b"
`
	requests := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		_, _ = w.Write([]byte(goodBody))
	}))
	t.Cleanup(srv.Close)

	workspace := t.TempDir()
	rulesURL := srv.URL + "/rules.yml"
	if _, err := WriteCachedSecretRules(workspace, rulesURL, "not: [valid", time.Hour, time.Now()); err != nil {
		t.Fatal(err)
	}

	rules, err := LoadRules(workspace, Options{DefaultRules: "off", RulesUpdateURL: rulesURL, RulesCacheTTL: time.Hour})
	if err != nil {
		t.Fatal(err)
	}
	if requests != 1 || len(rules) != 1 || rules[0].ID != "remote-secret" {
		t.Fatalf("requests=%d rules=%+v", requests, rules)
	}
	cached, _ := ReadCachedSecretRules(workspace, rulesURL)
	if cached == nil || cached.Body != goodBody {
		t.Fatalf("poisoned entry should be replaced by good fetch: %+v", cached)
	}
}

func TestRemoteSourceNameOmitsCredentials(t *testing.T) {
	ClearProcessCache()
	t.Cleanup(ClearProcessCache)

	yamlBody := `rules:
  - id: remote-secret
    message: Remote secret detected
    pattern-regex: "\\bremote_[A-Za-z0-9]{12}\\b"
`
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(yamlBody))
	}))
	t.Cleanup(srv.Close)

	const password = "hunter2pass"
	const signature = "s1gnatureToken"
	host := strings.TrimPrefix(srv.URL, "http://")
	rawURL := "http://alice:" + password + "@" + host + "/packs/rules.yml?sig=" + signature + "#frag"

	rules, err := LoadRules(t.TempDir(), Options{DefaultRules: "off", RulesUpdateURL: rawURL})
	if err != nil {
		t.Fatal(err)
	}
	if len(rules) != 1 {
		t.Fatalf("%+v", rules)
	}
	if want := "remote@" + host; rules[0].SourceName != want {
		t.Fatalf("SourceName=%q want %q", rules[0].SourceName, want)
	}
	hits := MatchRules("config.txt", []string{"token = remote_abcdefABCDEF"}, rules)
	if len(hits) != 1 {
		t.Fatalf("hits=%+v", hits)
	}
	for _, leaked := range []string{password, signature, "alice", "/packs/", "frag"} {
		if strings.Contains(hits[0].Evidence, leaked) {
			t.Fatalf("evidence %q leaks %q", hits[0].Evidence, leaked)
		}
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
