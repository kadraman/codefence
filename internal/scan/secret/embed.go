package secret

import _ "embed"

// BuiltinRulesVersion is the pack version string from rules/secret/builtin.yml.
const BuiltinRulesVersion = "2026-05-25"

//go:embed builtin.yml
var builtinYAML []byte

// BuiltinYAML returns the embedded builtin secret rules pack.
func BuiltinYAML() []byte {
	return builtinYAML
}
