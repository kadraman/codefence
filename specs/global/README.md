# Global specifications

Cross-cutting contracts. Feature specs MUST NOT silently contradict these files.

| File | Invariants |
|------|------------|
| [architecture.md](architecture.md) | Package layout, layering, aspect model, exit/MCP process models |
| [nfr.md](nfr.md) | Binary size, startup, dependency budgets B1–B7 |
| [testing.md](testing.md) | Test pyramid, fixtures, acceptance gates |
| [compatibility.md](compatibility.md) | Contract stability and deliberate v1 policies |

These are short MUST/MUST NOT docs with pointers into feature specs under `specs/features/`. Full user docs stay under `docs/`.
