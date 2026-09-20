package git

import (
	"testing"
)

func TestSplitNULPaths(t *testing.T) {
	t.Parallel()
	got := splitNULPaths([]byte("a.txt\x00 leading.txt\x00"))
	if len(got) != 2 || got[0] != "a.txt" || got[1] != " leading.txt" {
		t.Fatalf("%#v", got)
	}
	if splitNULPaths(nil) != nil {
		t.Fatal("nil input")
	}
	if len(splitNULPaths([]byte{0})) != 0 {
		t.Fatal("only NUL")
	}
}
