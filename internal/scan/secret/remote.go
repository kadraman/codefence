package secret

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/kadraman/codefence/internal/cache"
)

const (
	cacheEntryVersion = 1
	maxRedirects      = 5
	downloadTimeout   = 30 * time.Second
	maxBundleBytes    = 8 << 20
)

var errBundleTooLarge = fmt.Errorf("remote secret rules exceed %d MiB limit", maxBundleBytes>>20)

// CachedSecretRules is the on-disk remote pack entry under .codefence/cache/secret-rules/.
type CachedSecretRules struct {
	Version   int    `json:"version"`
	URL       string `json:"url"`
	FetchedAt string `json:"fetchedAt"`
	TTLMs     int64  `json:"ttlMs"`
	SHA256    string `json:"sha256"`
	Body      string `json:"body"`
}

func hashContent(content string) string {
	sum := sha256.Sum256([]byte(content))
	return hex.EncodeToString(sum[:])
}

func cacheFilePath(workspace, rulesURL string) string {
	sum := sha256.Sum256([]byte(rulesURL))
	key := hex.EncodeToString(sum[:])
	return filepath.Join(cache.CacheSecretRules(workspace), key+".json")
}

// ReadCachedSecretRules loads a cache entry and verifies body checksum metadata.
func ReadCachedSecretRules(workspace, rulesURL string) (*CachedSecretRules, error) {
	path := cacheFilePath(workspace, rulesURL)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var entry CachedSecretRules
	if err := json.Unmarshal(data, &entry); err != nil {
		return nil, nil
	}
	if entry.Version != cacheEntryVersion || entry.URL != rulesURL || hashContent(entry.Body) != entry.SHA256 {
		return nil, nil
	}
	return &entry, nil
}

// IsSecretRulesCacheFresh reports whether fetchedAt + ttl is still in the future.
func IsSecretRulesCacheFresh(entry *CachedSecretRules, ttl time.Duration, now time.Time) bool {
	if entry == nil {
		return false
	}
	fetched, err := time.Parse(time.RFC3339Nano, entry.FetchedAt)
	if err != nil {
		fetched, err = time.Parse(time.RFC3339, entry.FetchedAt)
		if err != nil {
			return false
		}
	}
	return fetched.Add(ttl).After(now)
}

// WriteCachedSecretRules writes a verified cache entry (checksum over body).
func WriteCachedSecretRules(workspace, rulesURL, body string, ttl time.Duration, fetchedAt time.Time) (*CachedSecretRules, error) {
	if fetchedAt.IsZero() {
		fetchedAt = time.Now().UTC()
	}
	entry := &CachedSecretRules{
		Version:   cacheEntryVersion,
		URL:       rulesURL,
		FetchedAt: fetchedAt.UTC().Format(time.RFC3339Nano),
		TTLMs:     ttl.Milliseconds(),
		SHA256:    hashContent(body),
		Body:      body,
	}
	path := cacheFilePath(workspace, rulesURL)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	data, err := json.MarshalIndent(entry, "", "  ")
	if err != nil {
		return nil, err
	}
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return nil, err
	}
	return entry, nil
}

func validateRulesURL(raw string) error {
	parsed, err := url.Parse(raw)
	if err != nil {
		return fmt.Errorf("invalid secret rules URL: %w", err)
	}
	switch parsed.Scheme {
	case "https":
		return nil
	case "http":
		host := strings.ToLower(parsed.Hostname())
		if host == "127.0.0.1" || host == "localhost" {
			return nil
		}
		return fmt.Errorf("remote secret rules must use https (http is allowed only for localhost)")
	default:
		return fmt.Errorf("remote secret rules must use https (http is allowed only for localhost)")
	}
}

// LoadRemoteRules fetches (or reuses TTL cache) a remote YAML pack and returns its
// parsed, compiled rules. Checksum metadata on the cache entry is verified before
// activation, and a fetched body only replaces the cache once it parses and
// compiles, so a malformed response never overwrites the last known-good pack.
// When a fetch fails and the cached pack is used instead, warn (if non-nil) is
// called with a message that identifies the pack only by sourceName.
func LoadRemoteRules(workspace, rulesURL, sourceName string, ttl time.Duration, refresh bool, warn func(string)) ([]Rule, error) {
	if err := validateRulesURL(rulesURL); err != nil {
		return nil, err
	}
	if ttl <= 0 {
		ttl = DefaultCacheTTL
	}

	var cachedRules []Rule
	cached, _ := ReadCachedSecretRules(workspace, rulesURL)
	if cached != nil {
		rules, err := parseRemoteBundle(cached.Body, sourceName)
		if err != nil {
			cached = nil
		} else {
			cachedRules = rules
		}
	}

	if !refresh && cached != nil && IsSecretRulesCacheFresh(cached, ttl, time.Now()) {
		if cached.TTLMs != ttl.Milliseconds() {
			_, _ = WriteCachedSecretRules(workspace, rulesURL, cached.Body, ttl, mustParseFetched(cached.FetchedAt))
		}
		return cachedRules, nil
	}

	useCached := func(reason string) []Rule {
		if warn != nil {
			warn(fmt.Sprintf(
				"remote secret rules %s could not be refreshed (%s); using cached pack fetched %s",
				sourceName, reason, cached.FetchedAt,
			))
		}
		return cachedRules
	}

	body, status, err := requestRuleBundle(rulesURL, 0)
	if err != nil {
		if cached != nil {
			return useCached(describeFetchError(err)), nil
		}
		return nil, err
	}
	if status < 200 || status >= 300 {
		if cached != nil {
			return useCached(fmt.Sprintf("HTTP %d", status)), nil
		}
		return nil, fmt.Errorf("failed to download remote secret rules: %d", status)
	}

	rules, err := parseRemoteBundle(body, sourceName)
	if err != nil {
		if cached != nil {
			return useCached("invalid rule pack: " + err.Error()), nil
		}
		return nil, err
	}
	if _, err := WriteCachedSecretRules(workspace, rulesURL, body, ttl, time.Now().UTC()); err != nil {
		return nil, fmt.Errorf("cache remote secret rules: %w", err)
	}
	return rules, nil
}

// describeFetchError summarizes a download failure without the request URL,
// which may carry credentials.
func describeFetchError(err error) string {
	if errors.Is(err, errBundleTooLarge) {
		return "download failed: " + errBundleTooLarge.Error()
	}
	var urlErr *url.Error
	if errors.As(err, &urlErr) {
		return "download failed: " + urlErr.Err.Error()
	}
	return "download failed"
}

func parseRemoteBundle(body, sourceName string) ([]Rule, error) {
	rules, err := ParseRuleBundle(body, sourceName, SourceRemote)
	if err != nil {
		return nil, err
	}
	if err := CompileRules(rules); err != nil {
		return nil, err
	}
	return rules, nil
}

func mustParseFetched(s string) time.Time {
	t, err := time.Parse(time.RFC3339Nano, s)
	if err != nil {
		t, err = time.Parse(time.RFC3339, s)
		if err != nil {
			return time.Now().UTC()
		}
	}
	return t
}

func requestRuleBundle(rawURL string, redirectDepth int) (body string, status int, err error) {
	if redirectDepth > maxRedirects {
		return "", 0, fmt.Errorf("too many redirects while downloading secret rules")
	}
	if err := validateRulesURL(rawURL); err != nil {
		return "", 0, err
	}

	client := &http.Client{
		Timeout: downloadTimeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	req, err := http.NewRequest(http.MethodGet, rawURL, nil)
	if err != nil {
		return "", 0, err
	}
	res, err := client.Do(req)
	if err != nil {
		return "", 0, fmt.Errorf("download secret rules: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode >= 300 && res.StatusCode < 400 {
		loc := res.Header.Get("Location")
		if loc == "" {
			return "", res.StatusCode, fmt.Errorf("redirect without location from %s", rawURL)
		}
		next, err := url.Parse(loc)
		if err != nil {
			return "", res.StatusCode, err
		}
		base, _ := url.Parse(rawURL)
		nextURL := base.ResolveReference(next).String()
		return requestRuleBundle(nextURL, redirectDepth+1)
	}

	data, err := io.ReadAll(io.LimitReader(res.Body, maxBundleBytes+1))
	if err != nil {
		return "", res.StatusCode, err
	}
	if len(data) > maxBundleBytes {
		return "", res.StatusCode, errBundleTooLarge
	}
	return string(data), res.StatusCode, nil
}
