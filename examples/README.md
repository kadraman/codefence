# Examples directory

This directory contains sample fixtures for exercising codefence behavior in local development.

## Secret-scanning fixtures

Path: `examples/secrets/`

All values in these files are intentionally fake test strings. They are designed to trigger secret-detection rules and are not real credentials.

To reduce GitHub push-protection friction, examples avoid provider-specific token signatures (for example real-looking `ghp_`, `glpat-`, or `sk_live_` forms).

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
