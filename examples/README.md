# Examples directory

This directory contains sample fixtures for exercising codefence behavior in local development.
For repository-wide defaults (including ignored prefixes), see [`codefence-config.yml.example`](codefence-config.yml.example).

## Secret-scanning fixtures

Path: `examples/secrets/`

All values in these files are intentionally fake test strings. They are designed to trigger secret-detection rules and are not real credentials.

To reduce GitHub push-protection friction, most examples avoid provider-specific token signatures (for example real-looking `ghp_`, `glpat-`, or `sk_live_` forms). The private-key block fixture uses an obviously fake PEM block for the built-in `secret-private-key` rule.


| Fixture                       | Typical built-in rule IDs                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| `fake-secrets.ts`             | `no-hardcoded-secret`, `secret-bearer-token`, `secret-password-assignment`, `secret-high-entropy` |
| `fake-uri-credentials.conf`   | `secret-uri-credentials`                                                                          |
| `fake-private-key-block.conf` | `secret-private-key`                                                                              |
| `fake-private-key.pem`        | Placeholder only (no PEM header)                                                                  |


Run against the fixture set:

```bash
npm run build
node dist/src/cli.js scan --paths examples/secrets
```

You can also target a single fixture file:

```bash
node dist/src/cli.js scan --paths examples/secrets/fake-secrets.ts
```

Note: git-changed scans ignore `examples/` by default. Explicit `--paths` includes these files.

Scans against these fixtures are expected to **exit with code 1** (findings are intentional). Use them to verify rules, not as a clean baseline.

## Dependency-scanning fixtures

Path: `examples/deps/`

Sample dependency manifests (npm, Python, Go, Ruby, PHP) pin exact or lockfile-resolved versions of packages with known OSV advisories. See [examples/deps/README.md](deps/README.md) for the fixture list and commands.

```bash
node dist/src/cli.js scan --only deps --paths examples/deps
```

Scans against these fixtures are expected to **exit with code 1** (findings are intentional).

## Secret rule bundles

Built-in Semgrep-style rules live at [rules/secret/builtin.yml](../rules/secret/builtin.yml).

An extra downloadable bundle for remote-rule demos is under [examples/rules/](rules/README.md) (serve locally or fetch via `https://raw.githubusercontent.com/...`).