# Example secret rule bundles

Semgrep-style YAML bundles used to demonstrate local and remote rule loading.

## Built-in bundle (shipped with Codefence)

Path in the repository: [`rules/secret/builtin.yml`](../../rules/secret/builtin.yml)

This file is the source of truth for default secret rules. The scanner loads it automatically unless `--secret-default-rules off` is set.

## Extra bundle (remote download demo)

[`extra-secrets-bundle.yml`](extra-secrets-bundle.yml) adds example-only rules that match strings in [`../secrets/`](../secrets/) fixtures.

### Serve over HTTP(S) locally

From the repository root:

```bash
npx --yes serve examples/rules -l 8765
```

Scan fixtures with the remote bundle (refresh cache on first run):

```bash
npm run build
node dist/src/cli.js scan --paths examples/secrets \
  --secret-rules-update-url http://127.0.0.1:8765/extra-secrets-bundle.yml \
  --secret-rules-refresh
```

Expect findings from both built-in rules and remote rules such as `example-ci-deploy-token`. Exit code **1** is normal for these fixtures.

### Published raw URL (when this repo is on GitHub)

Replace `ORG/REPO` with your fork:

```text
https://raw.githubusercontent.com/ORG/REPO/main/examples/rules/extra-secrets-bundle.yml
```

```bash
codefence scan --paths examples/secrets \
  --secret-rules-update-url https://raw.githubusercontent.com/ORG/REPO/main/examples/rules/extra-secrets-bundle.yml \
  --secret-rules-refresh
```

Remote bundles are cached under `.codefence/cache/secret-rules/` in the target workspace.
