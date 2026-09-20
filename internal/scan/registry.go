package scan

import "fmt"

// DefaultRegistryOrder is the sequential execution order for aspects.
var DefaultRegistryOrder = []AspectID{AspectCode, AspectDeps}

// Registry maps aspect IDs to runners.
type Registry map[AspectID]AspectRunner

// DefaultRegistry returns production aspect runners.
// Engines for code/deps (features 006–009) are not wired yet; when work is in
// scope the aspect fails closed instead of reporting success (constitution § II).
func DefaultRegistry() Registry {
	return Registry{
		AspectCode: pendingAspect(AspectCode),
		AspectDeps: pendingAspect(AspectDeps),
	}
}

func pendingAspect(id AspectID) AspectRunner {
	return func(ctx Context) AspectOutcome {
		if id == AspectCode && len(ctx.Files) == 0 && !ctx.Options.DepsScopeIsTree() {
			return AspectOutcome{Aspect: id, Status: StatusSkipped, ExitCode: 0, Message: "no files in scope"}
		}
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
