# Compatibility and Stability (global)

## Contract stability (MUST)

CLI flags, aspect model, finding fields (library), CLI NDJSON wire keys, config keys, secret/deps semantics, and rule IDs MUST remain stable unless a feature spec documents a deliberate change with migration notes.

Distribution: the `codefence` binary is this repository’s product.

## Deliberate v1 policies

| Topic | Policy |
| ----- | ------ |
| Usage / config CLI exit | Exit code `2` when distinguishable. Finding failures remain `1`. |
| Hooks | Invoke the `codefence` binary on PATH (or configured absolute path). |
| MCP | Tools return Finding-shaped JSON ([features/003](../features/003-finding-model/)), not CLI NDJSON. |
| `version` command | Build identity for the binary. |

## Stability non-goals to protect

1. Do not rename CLI NDJSON wire keys without a versioned migration (see feature `004-output-formats`).
2. Do not change builtin secret rule IDs or secure-coding rule IDs without migration and agent-doc updates.
3. Keep AI install marker names stable (`<!-- codefence-guardrails:start -->` / `end`).

## References

- Constitution § III–IV
