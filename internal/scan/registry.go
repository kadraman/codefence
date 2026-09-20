package scan

// DefaultRegistryOrder is the sequential execution order for aspects.
var DefaultRegistryOrder = []AspectID{AspectCode, AspectDeps}

// Registry maps aspect IDs to runners.
type Registry map[AspectID]AspectRunner

// DefaultRegistry returns stub runners for code and deps (engines land in 006–009).
func DefaultRegistry() Registry {
	return Registry{
		AspectCode: stubAspect(AspectCode),
		AspectDeps: stubAspect(AspectDeps),
	}
}

func stubAspect(id AspectID) AspectRunner {
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
		return AspectOutcome{Aspect: id, Status: StatusOK, ExitCode: 0, Message: ""}
	}
}

// DepsScopeIsTree reports whether deps scope is tree.
func (o Options) DepsScopeIsTree() bool {
	return o.DepsScope == "tree"
}
