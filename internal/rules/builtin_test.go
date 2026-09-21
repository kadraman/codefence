package rules

import "testing"

func TestBuiltin_ThreeV1Rules(t *testing.T) {
	got := Builtin()
	if len(got) != 3 {
		t.Fatalf("len %d", len(got))
	}
	want := []string{IDNoEval, IDNoShellTrue, IDNoInsecureHTTP}
	for i, id := range want {
		if got[i].ID != id {
			t.Fatalf("index %d: %q want %q", i, got[i].ID, id)
		}
		if got[i].LineWindow() != 1 {
			t.Fatalf("%s window %d", id, got[i].LineWindow())
		}
	}
}
