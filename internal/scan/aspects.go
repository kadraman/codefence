package scan

// ResolveAspects selects aspects per FR-006–FR-008.
// onlySpecified is true when the user set --only (or CODEFENCE_ONLY).
// skipDeps is true when --skip deps (or env) was set.
func ResolveAspects(opts Options, manifestsInScope bool, treeScope bool) []AspectID {
	onlySpecified := len(opts.Only) > 0
	var selected []string
	if onlySpecified {
		selected = append([]string(nil), opts.Only...)
	} else if len(opts.Aspects) > 0 {
		selected = append([]string(nil), opts.Aspects...)
	} else {
		selected = []string{string(AspectCode)}
	}

	skip := map[string]bool{}
	for _, s := range opts.Skip {
		skip[s] = true
	}
	filtered := make([]string, 0, len(selected))
	for _, a := range selected {
		if skip[a] {
			continue
		}
		filtered = append(filtered, a)
	}

	// Auto-add deps after skip, unless --only was specified or --skip deps.
	if !onlySpecified && !skip[string(AspectDeps)] {
		if manifestsInScope || treeScope {
			if !containsAspect(filtered, string(AspectDeps)) {
				filtered = append(filtered, string(AspectDeps))
			}
		}
	}
	// Re-check skip deps so auto-add cannot re-include.
	if skip[string(AspectDeps)] {
		filtered = removeAspect(filtered, string(AspectDeps))
	}

	// Preserve registry order.
	out := make([]AspectID, 0, len(filtered))
	for _, id := range DefaultRegistryOrder {
		if containsAspect(filtered, string(id)) {
			out = append(out, id)
		}
	}
	return out
}

func containsAspect(list []string, id string) bool {
	for _, a := range list {
		if a == id {
			return true
		}
	}
	return false
}

func removeAspect(list []string, id string) []string {
	out := make([]string, 0, len(list))
	for _, a := range list {
		if a != id {
			out = append(out, a)
		}
	}
	return out
}
