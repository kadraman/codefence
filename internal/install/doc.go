// Package install merges AI assistant guardrail files (feature 011).
//
// Coordination note (feature 002 T031): when install lands, it MUST ensure
// `.codefence/` is listed in the consuming repo's .gitignore. Path contracts
// for that directory are defined in internal/cache.
package install
