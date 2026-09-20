package scan

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/kadraman/codefence/internal/git"
	"github.com/kadraman/codefence/internal/scan/deps"
)

// BuildContext resolves cwd, file list, and optional tree-scope manifests.
func BuildContext(cwd string, opts Options) (Context, error) {
	if cwd == "" {
		var err error
		cwd, err = os.Getwd()
		if err != nil {
			return Context{}, fmt.Errorf("resolve cwd: %w", err)
		}
	}
	ctx := Context{
		CWD:     cwd,
		Staged:  opts.Staged,
		Options: opts,
	}

	if len(opts.Paths) > 0 {
		ctx.ExplicitPaths = true
		files, err := expandPaths(cwd, opts.Paths)
		if err != nil {
			return Context{}, err
		}
		ctx.Files = files
	} else {
		var (
			files []string
			err   error
		)
		if opts.Staged {
			files, err = git.StagedFiles(cwd)
		} else {
			files, err = git.WorkingTreeFiles(cwd)
		}
		if err != nil {
			return Context{}, err
		}
		ctx.Files = filterIgnoredPrefixes(files, opts.GitIgnoredPrefixes)
	}

	if opts.DepsScopeIsTree() {
		roots := []string{"."}
		if ctx.ExplicitPaths {
			roots = opts.Paths
		}
		manifests, err := deps.DiscoverManifests(cwd, roots)
		if err != nil {
			return Context{}, err
		}
		ctx.DepsManifestPaths = manifests
	}

	return ctx, nil
}

func expandPaths(cwd string, paths []string) ([]string, error) {
	seen := map[string]bool{}
	var out []string
	for _, p := range paths {
		abs := p
		if !filepath.IsAbs(p) {
			abs = filepath.Join(cwd, p)
		}
		fi, err := os.Stat(abs)
		if err != nil {
			return nil, fmt.Errorf("path %q: %w", p, err)
		}
		if fi.IsDir() {
			err := filepath.WalkDir(abs, func(path string, d fs.DirEntry, err error) error {
				if err != nil {
					return err
				}
				if d.IsDir() {
					return nil
				}
				rel, err := filepath.Rel(cwd, path)
				if err != nil {
					rel = path
				}
				rel = filepath.ToSlash(rel)
				if !seen[rel] {
					seen[rel] = true
					out = append(out, rel)
				}
				return nil
			})
			if err != nil {
				return nil, err
			}
			continue
		}
		rel, err := filepath.Rel(cwd, abs)
		if err != nil {
			rel = p
		}
		rel = filepath.ToSlash(rel)
		if !seen[rel] {
			seen[rel] = true
			out = append(out, rel)
		}
	}
	return out, nil
}
