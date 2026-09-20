package git

import (
	"bytes"
	"fmt"
	"os/exec"
	"strings"
)

// StagedFiles returns paths of staged changes (Added/Copied/Modified/Renamed).
func StagedFiles(cwd string) ([]string, error) {
	return gitPaths(cwd, "diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z")
}

// WorkingTreeFiles returns unstaged modifications plus untracked files
// (working-tree changes relative to HEAD index).
func WorkingTreeFiles(cwd string) ([]string, error) {
	unstaged, err := gitPaths(cwd, "diff", "--name-only", "--diff-filter=ACMR", "-z")
	if err != nil {
		return nil, err
	}
	untracked, err := gitPaths(cwd, "ls-files", "--others", "--exclude-standard", "-z")
	if err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	out := make([]string, 0, len(unstaged)+len(untracked))
	for _, p := range append(unstaged, untracked...) {
		if p == "" || seen[p] {
			continue
		}
		seen[p] = true
		out = append(out, p)
	}
	return out, nil
}

func gitPaths(cwd string, args ...string) ([]string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = cwd
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return nil, fmt.Errorf("git %s: %s", strings.Join(args, " "), msg)
	}
	return splitNULPaths(stdout.Bytes()), nil
}

// splitNULPaths splits NUL-delimited (-z) Git path lists without trimming
// whitespace so paths are preserved byte-for-byte.
func splitNULPaths(raw []byte) []string {
	if len(raw) == 0 {
		return nil
	}
	parts := bytes.Split(raw, []byte{0})
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if len(p) == 0 {
			continue
		}
		out = append(out, string(p))
	}
	return out
}
