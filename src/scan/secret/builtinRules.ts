import { BUILTIN_SECRET_RULES_VERSION, SecretRule } from "./types";

export const builtinSecretRules: SecretRule[] = [
  {
    id: "secret-github-token",
    description: "Detect GitHub personal access tokens",
    message: "Potential GitHub token detected",
    severity: "high",
    confidence: "high",
    remediation: "Remove the token, rotate it, and load credentials from environment or secret storage.",
    patterns: [{ type: "regex", value: "\\bgh[pousr]_[A-Za-z0-9]{36,255}\\b" }],
    source: "builtin",
    sourceName: `builtin@${BUILTIN_SECRET_RULES_VERSION}`
  },
  {
    id: "secret-gitlab-token",
    description: "Detect GitLab tokens",
    message: "Potential GitLab token detected",
    severity: "high",
    confidence: "high",
    remediation: "Remove the token, rotate it, and move it to a managed secret store.",
    patterns: [{ type: "regex", value: "\\bglpat-[A-Za-z0-9_-]{20,255}\\b" }],
    source: "builtin",
    sourceName: `builtin@${BUILTIN_SECRET_RULES_VERSION}`
  },
  {
    id: "secret-stripe-key",
    description: "Detect Stripe API keys",
    message: "Potential Stripe API key detected",
    severity: "high",
    confidence: "high",
    remediation: "Replace embedded Stripe keys with environment-based configuration and rotate exposed keys.",
    patterns: [{ type: "regex", value: "\\bsk_(?:live|test)_[A-Za-z0-9]{16,}\\b" }],
    source: "builtin",
    sourceName: `builtin@${BUILTIN_SECRET_RULES_VERSION}`
  },
  {
    id: "secret-bearer-token",
    description: "Detect bearer tokens",
    message: "Potential bearer token detected",
    severity: "high",
    confidence: "medium",
    remediation: "Avoid embedding bearer tokens in source files; inject them from runtime configuration.",
    patterns: [{ type: "regex", value: "\\bBearer\\s+[A-Za-z0-9._\\-+/=]{16,}\\b" }],
    source: "builtin",
    sourceName: `builtin@${BUILTIN_SECRET_RULES_VERSION}`
  },
  {
    id: "secret-private-key",
    description: "Detect PEM private key material",
    message: "Potential private key material detected",
    severity: "high",
    confidence: "high",
    remediation: "Remove private keys from source control immediately and rotate any exposed key material.",
    patterns: [{ type: "regex", value: "-----BEGIN (?:RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----" }],
    source: "builtin",
    sourceName: `builtin@${BUILTIN_SECRET_RULES_VERSION}`
  },
  {
    id: "secret-password-assignment",
    description: "Detect password-like assignments",
    message: "Potential hardcoded password detected",
    severity: "high",
    confidence: "medium",
    remediation: "Do not commit passwords; use environment variables or a secret manager instead.",
    patterns: [
      {
        type: "regex",
        value:
          "(?:password|passwd|pwd)\\s*[:=]\\s*[\"'][^\"'\\n]{8,}[\"']"
      }
    ],
    source: "builtin",
    sourceName: `builtin@${BUILTIN_SECRET_RULES_VERSION}`
  },
  {
    id: "secret-uri-credentials",
    description: "Detect credentials embedded in URIs",
    message: "Potential credentials embedded in URI detected",
    severity: "high",
    confidence: "high",
    remediation: "Move credentials out of URIs and into environment or dedicated secret configuration.",
    patterns: [{ type: "regex", value: "\\b[a-z][a-z0-9+.-]*://[^\\s:@/]+:[^\\s:@/]+@" }],
    source: "builtin",
    sourceName: `builtin@${BUILTIN_SECRET_RULES_VERSION}`
  },
  {
    id: "no-hardcoded-secret",
    description: "Detect generic token-style assignments",
    message: "Potential hardcoded secret detected",
    severity: "high",
    confidence: "medium",
    remediation: "Replace embedded credentials with runtime-configured secrets.",
    patterns: [
      {
        type: "regex",
        value:
          "(?:api[_-]?key|secret|token|access[_-]?token|client[_-]?secret)\\s*[:=]\\s*[\"'][A-Za-z0-9_\\-+/=]{12,}[\"']"
      }
    ],
    source: "builtin",
    sourceName: `builtin@${BUILTIN_SECRET_RULES_VERSION}`
  }
];
