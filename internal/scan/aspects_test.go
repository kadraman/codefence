package scan

import (
	"testing"
)

func TestResolveAspects(t *testing.T) {
	cases := []struct {
		name            string
		opts            Options
		manifests       bool
		tree            bool
		want            []AspectID
	}{
		{
			name: "default_code_only",
			opts: Options{Aspects: []string{"code"}},
			want: []AspectID{AspectCode},
		},
		{
			name:      "auto_deps_with_manifest",
			opts:      Options{Aspects: []string{"code"}},
			manifests: true,
			want:      []AspectID{AspectCode, AspectDeps},
		},
		{
			name: "auto_deps_tree_scope",
			opts: Options{Aspects: []string{"code"}, DepsScope: "tree"},
			tree: true,
			want: []AspectID{AspectCode, AspectDeps},
		},
		{
			name: "only_code_no_auto",
			opts: Options{Only: []string{"code"}},
			manifests: true,
			want: []AspectID{AspectCode},
		},
		{
			name:      "skip_deps_blocks_auto",
			opts:      Options{Aspects: []string{"code"}, Skip: []string{"deps"}},
			manifests: true,
			want:      []AspectID{AspectCode},
		},
		{
			name:      "skip_code_still_auto_deps",
			opts:      Options{Aspects: []string{"code"}, Skip: []string{"code"}},
			manifests: true,
			want:      []AspectID{AspectDeps},
		},
		{
			name: "only_deps",
			opts: Options{Only: []string{"deps"}},
			want: []AspectID{AspectDeps},
		},
		{
			name: "skip_both",
			opts: Options{Aspects: []string{"code", "deps"}, Skip: []string{"code", "deps"}},
			want: []AspectID{},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := ResolveAspects(tc.opts, tc.manifests, tc.tree)
			if len(got) != len(tc.want) {
				t.Fatalf("got %#v want %#v", got, tc.want)
			}
			for i := range got {
				if got[i] != tc.want[i] {
					t.Fatalf("got %#v want %#v", got, tc.want)
				}
			}
		})
	}
}

func TestFilterIgnoredPrefixes(t *testing.T) {
	files := []string{"src/a.go", "examples/x.go", "lib/b.go"}
	got := filterIgnoredPrefixes(files, []string{"examples/"})
	if len(got) != 2 || got[0] != "src/a.go" || got[1] != "lib/b.go" {
		t.Fatalf("%#v", got)
	}
}
