package git_test

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/kadraman/codefence/internal/git"
)

func TestStagedAndWorkingTree(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not available")
	}
	dir := t.TempDir()
	run := func(args ...string) {
		cmd := exec.Command("git", args...)
		cmd.Dir = dir
		cmd.Env = append(os.Environ(), "GIT_AUTHOR_NAME=t", "GIT_AUTHOR_EMAIL=t@t", "GIT_COMMITTER_NAME=t", "GIT_COMMITTER_EMAIL=t@t")
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v (%s)", args, err, out)
		}
	}
	run("init")
	run("config", "user.email", "t@t")
	run("config", "user.name", "t")
	if err := os.WriteFile(filepath.Join(dir, "a.txt"), []byte("a"), 0o644); err != nil {
		t.Fatal(err)
	}
	run("add", "a.txt")
	run("commit", "-m", "init")

	if err := os.WriteFile(filepath.Join(dir, "b.txt"), []byte("b"), 0o644); err != nil {
		t.Fatal(err)
	}
	run("add", "b.txt")
	staged, err := git.StagedFiles(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(staged) != 1 || staged[0] != "b.txt" {
		t.Fatalf("staged %#v", staged)
	}

	if err := os.WriteFile(filepath.Join(dir, "c.txt"), []byte("c"), 0o644); err != nil {
		t.Fatal(err)
	}
	working, err := git.WorkingTreeFiles(dir)
	if err != nil {
		t.Fatal(err)
	}
	foundC := false
	for _, f := range working {
		if f == "c.txt" {
			foundC = true
		}
	}
	if !foundC {
		t.Fatalf("working %#v missing c.txt", working)
	}
}

func TestStaged_PreservesWhitespaceAndSpecialChars(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not available")
	}
	dir := t.TempDir()
	run := func(args ...string) {
		cmd := exec.Command("git", args...)
		cmd.Dir = dir
		cmd.Env = append(os.Environ(), "GIT_AUTHOR_NAME=t", "GIT_AUTHOR_EMAIL=t@t", "GIT_COMMITTER_NAME=t", "GIT_COMMITTER_EMAIL=t@t")
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v (%s)", args, err, out)
		}
	}
	run("init")
	run("config", "user.email", "t@t")
	run("config", "user.name", "t")
	if err := os.WriteFile(filepath.Join(dir, "init.txt"), []byte("i"), 0o644); err != nil {
		t.Fatal(err)
	}
	run("add", "init.txt")
	run("commit", "-m", "init")

	name := " weird name.txt"
	if err := os.WriteFile(filepath.Join(dir, name), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	run("add", "--", name)
	staged, err := git.StagedFiles(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(staged) != 1 || staged[0] != name {
		t.Fatalf("staged %#v want %q", staged, name)
	}
}

