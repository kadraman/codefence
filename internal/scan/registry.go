package scan

import (
	"fmt"

	"github.com/kadraman/codefence/internal/scan/code"
)

// DefaultRegistryOrder is the sequential execution order for aspects.
var DefaultRegistryOrder = []AspectID{AspectCode, AspectDeps}

// Registry maps aspect IDs to runners.
type Registry map[AspectID]AspectRunner

// DefaultRegistry returns production aspect runners.
// The deps engine (features 008–009) is not wired yet; when work is in
// scope the aspect fails closed instead of reporting success (constitution § II).
func DefaultRegistry() Registry {
	return Registry{
		AspectCode: runCodeAspect,
		AspectDeps: pendingAspect(AspectDeps),
	}
}

func runCodeAspect(ctx Context) AspectOutcome {
	if len(ctx.Files) == 0 && !ctx.Options.DepsScopeIsTree() {
		return AspectOutcome{Aspect: AspectCode, Status: StatusSkipped, ExitCode: 0, Message: "no files in scope"}
	}
	secretOpts := code.SecretOptions{
		Rules:               append([]string(nil), ctx.Options.SecretRules...),
		DefaultRules:        ctx.Options.SecretDefaultRules,
		DefaultRulesVersion: ctx.Options.SecretDefaultRulesVersion,
		RulesUpdateURL:      ctx.Options.SecretRulesUpdateURL,
		RulesRefresh:        ctx.Options.SecretRulesRefresh,
		RulesCacheTTL:       ctx.Options.SecretRulesCacheTTL,
		EntropyThreshold:    ctx.Options.SecretEntropyThreshold,
		MinLength:           ctx.Options.SecretMinLength,
		MinConfidence:       ctx.Options.SecretMinConfidence,
	}
	found, err := code.ScanFiles(ctx.CWD, ctx.Files, secretOpts)
	if err != nil {
		return AspectOutcome{
			Aspect:   AspectCode,
			Status:   StatusFailed,
			ExitCode: 1,
			Message:  err.Error(),
		}
	}
	if len(found) > 0 {
		return AspectOutcome{
			Aspect:   AspectCode,
			Status:   StatusFailed,
			ExitCode: 1,
			Findings: found,
		}
	}
	return AspectOutcome{Aspect: AspectCode, Status: StatusOK, ExitCode: 0}
}

func pendingAspect(id AspectID) AspectRunner {
	return func(ctx Context) AspectOutcome {
		if id == AspectDeps {
			hasManifests := false
			for _, f := range ctx.Files {
				if IsManifest(f) {
					hasManifests = true
					break
				}
			}
			if len(ctx.DepsManifestPaths) > 0 {
				hasManifests = true
			}
			if !hasManifests {
				return AspectOutcome{Aspect: id, Status: StatusSkipped, ExitCode: 0, Message: "no dependency manifests in scope"}
			}
		}
		return AspectOutcome{
			Aspect:   id,
			Status:   StatusFailed,
			ExitCode: 1,
			Message:  fmt.Sprintf("%s aspect engine not implemented yet", id),
		}
	}
}

// DepsScopeIsTree reports whether deps scope is tree.
func (o Options) DepsScopeIsTree() bool {
	return o.DepsScope == "tree"
}
