# SAST rule samples (Java)

`SastVulnerableSamples.java` contains **intentionally vulnerable** patterns aligned with each line-based SAST rule in `src/rules/sast/`.

## Scan

From the repository root (after `npm ci` or `npm run build`):

```bash
codefence scan --only code --paths examples/java/sast-vulnerabilities/
```

In this repo you can also use:

```bash
npm run build
node dist/src/cli.js scan --only code --paths examples/java/sast-vulnerabilities/
```

(`npm run codefence` runs `codefence scan --staged` only — use `--paths` as above to scan these demos.)

Expect **22 findings** covering all **14 SAST rules**:

- Inline SQL concatenation in the API call (original samples).
- Six additional findings where dynamic SQL is built on prior lines and passed as a variable (sliding-window analysis).
- Cookie and XXE rules use **method-block look-ahead**: `new Cookie()` / `newInstance()` are not reported when `setHttpOnly(true)`, `setSecure(true)`, `setFeature(...)`, or `setExpandEntityReferences(false)` appear later in the same method. Hardened sample methods at the bottom of the file demonstrate this.
- Hibernate and JPA SQL rules use receiver patterns (`session.` vs `em.` / `entityManager.`) so they no longer double-fire on the same line.
- A single `return new jakarta.servlet.http.Cookie(...)` line reports both cookie rules (HttpOnly and Secure).

## Rule coverage

| Rule ID | Sample location (approx.) |
| --- | --- |
| `sast-sql-injection-jdbc-template` | `jdbcTemplateSqlInjection` |
| `sast-sql-injection-jdbc-statement` | `jdbcStatementSqlInjection` |
| `sast-sql-injection-hibernate-native-query` | `hibernateNativeQuerySqlInjection` |
| `sast-sql-injection-hibernate-hql` | `hibernateHqlSqlInjection` |
| `sast-sql-injection-jpa-create-native-query` | `jpaNativeQuerySqlInjection` |
| `sast-sql-injection-jpa-create-query` | `jpaJpqlSqlInjection` |
| `sast-xxe-document-builder-factory` | `documentBuilderFactoryXxe` |
| `sast-xxe-transformer-factory` | `transformerFactoryXxe` |
| `sast-json-injection-jackson-write-raw` | `jacksonWriteRaw` |
| `sast-insecure-randomness-java-util-random` | `insecureRandom` |
| `sast-insecure-randomness-secure-random-constant-seed` | `secureRandomConstantSeed` |
| `sast-cookie-security-httponly-not-set` | `cookieWithoutFlags`, `cookieHttpOnlyDisabled` |
| `sast-cookie-security-secure-not-set` | `cookieWithoutFlags`, `cookieSecureDisabled` |
| `sast-missing-csp-spring-security` | `configure(HttpSecurity)` |

**Git-based scans** (`codefence scan --staged` / unstaged changed files) **skip:** `examples/`, `tests/sast/`, `src/rules/sast/` (same list as `codefence scan --help`). **Explicit `--paths` still scans those files** — use the commands above so CI and local demos do not fail when this tree changes.

These samples exercise **local embedded secure-coding rules** only. See the [top-level README](../../../README.md).
