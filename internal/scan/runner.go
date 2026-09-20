package scan

import (
	"fmt"
	"io"

	"github.com/kadraman/codefence/internal/output"
)

// RunScan builds context, resolves aspects, runs them sequentially, aggregates exit.
func RunScan(opts Options, stdout, stderr io.Writer) (Result, error) {
	return RunScanWithRegistry(opts, DefaultRegistry(), stdout, stderr)
}

// RunScanWithRegistry is like RunScan but uses a custom registry (tests / stubs).
func RunScanWithRegistry(opts Options, reg Registry, stdout, stderr io.Writer) (Result, error) {
	ctx, err := BuildContext("", opts)
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

	var result Result
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
			_ = w.WriteTable(fmt.Sprintf("--- %s ---", id), outcome.Findings)
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
