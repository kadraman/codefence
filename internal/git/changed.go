package git

import (
	"bytes"
	"fmt"
	"os/exec"
	"strings"
)

// StagedFiles returns paths of staged changes (Added/Copied/Modified/Renamed).
func StagedFiles(cwd string) ([]string, error) {
	return gitLines(cwd, "diff", "--cached", "--name-only", "--diff-filter=ACMR")
}

// WorkingTreeFiles returns unstaged modifications plus untracked files
// (working-tree changes relative to HEAD index).
func WorkingTreeFiles(cwd string) ([]string, error) {
	unstaged, err := gitLines(cwd, "diff", "--name-only", "--diff-filter=ACMR")
	if err != nil {
		return nil, err
	}
	untracked, err := gitLines(cwd, "ls-files", "--others", "--exclude-standard")
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

func gitLines(cwd string, args ...string) ([]string, error) {
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
	raw := strings.Split(strings.ReplaceAll(stdout.String(), "\r\n", "\n"), "\n")
	out := make([]string, 0, len(raw))
	for _, line := range raw {
		line = strings.TrimSpace(line)
		if line != "" {
			out = append(out, line)
		}
	}
	return out, nil
}
