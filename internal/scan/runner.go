package scan

import (
	"fmt"
	"io"

	"github.com/kadraman/codefence/internal/output"
)

// RunScan builds context for cwd, resolves aspects, runs them sequentially, aggregates exit.
// Empty cwd resolves to the process working directory (CLI default). MCP and other
// callers MUST pass the configured repository root instead of changing process cwd.
func RunScan(cwd string, opts Options, stdout, stderr io.Writer) (Result, error) {
	return RunScanWithRegistry(cwd, opts, DefaultRegistry(), stdout, stderr)
}

// RunScanWithRegistry is like RunScan but uses a custom registry (tests / stubs).
func RunScanWithRegistry(cwd string, opts Options, reg Registry, stdout, stderr io.Writer) (Result, error) {
	ctx, err := BuildContext(cwd, opts)
	if err != nil {
		return Result{}, err
	}
	return runWithContext(ctx, reg, stdout, stderr)
}

func runWithContext(ctx Context, reg Registry, stdout, stderr io.Writer) (Result, error) {
	manifestsInScope := HasManifestInScope(ctx.Files) || len(ctx.DepsManifestPaths) > 0
	treeScope := ctx.Options.DepsScopeIsTree()
	aspects := ResolveAspects(ctx.Options, manifestsInScope, treeScope)

	format := output.FormatTable
	if ctx.Options.Format == "json" {
		format = output.FormatJSON
	}
	w := output.NewWriter(output.Options{
		Format:  format,
		Quiet:   ctx.Options.Quiet,
		Verbose: ctx.Options.Verbose,
		Color:   true,
	}, stdout, stderr)

	if len(aspects) > 0 {
		ids := make([]string, len(aspects))
		for i, a := range aspects {
			ids[i] = string(a)
		}
		w.Progress("Running scan aspects: %s", joinComma(ids))
	}

	result := Result{CWD: ctx.CWD}
	for _, id := range aspects {
		runner, ok := reg[id]
		if !ok {
			result.Outcomes = append(result.Outcomes, AspectOutcome{
				Aspect: id, Status: StatusFailed, ExitCode: 1,
				Message: fmt.Sprintf("unknown aspect %q", id),
			})
			continue
		}
		outcome := runner(ctx)
		logAspectStatus(w, outcome)
		if len(outcome.Findings) > 0 {
			if err := w.WriteTable(string(id), fmt.Sprintf("--- %s ---", id), outcome.Findings); err != nil {
				result.Outcomes = append(result.Outcomes, outcome)
				result.ExitCode = 1
				return result, fmt.Errorf("write findings for aspect %s: %w", id, err)
			}
		}
		result.Outcomes = append(result.Outcomes, outcome)
	}

	result.ExitCode = 0
	for _, o := range result.Outcomes {
		if o.Status == StatusFailed || o.ExitCode != 0 {
			result.ExitCode = 1
			break
		}
	}
	if result.ExitCode == 0 {
		w.Progress("Scan completed successfully.")
	} else {
		w.Progress("Scan failed.")
	}
	return result, nil
}

func joinComma(parts []string) string {
	out := ""
	for i, p := range parts {
		if i > 0 {
			out += ", "
		}
		out += p
	}
	return out
}
