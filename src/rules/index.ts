import { Rule } from "../types";

const secretRegex = /(api[_-]?key|secret|token|password)\s*[:=]\s*["'][^"']{8,}["']/i;

const baseRules: Rule[] = [
  {
    id: "no-hardcoded-secret",
    description: "Flags likely hardcoded secrets",
    severity: "high",
    test: (line) => secretRegex.test(line),
    message: "Potential hardcoded secret detected"
  },
  {
    id: "no-eval",
    description: "Disallow dynamic code execution",
    severity: "high",
    test: (line) => /\beval\s*\(/.test(line) || /\bnew\s+Function\s*\(/.test(line),
    message: "Avoid eval/new Function and use safer alternatives"
  },
  {
    id: "no-shell-true",
    description: "Avoid shell execution in child_process",
    severity: "medium",
    test: (line) => /shell\s*:\s*true/.test(line),
    message: "Avoid child_process with shell enabled unless strictly necessary"
  },
  {
    id: "no-insecure-http",
    description: "Disallow insecure HTTP endpoints",
    severity: "medium",
    test: (line) => /http:\/\/(?!localhost|127\.0\.0\.1)/i.test(line),
    message: "Use HTTPS for remote endpoints"
  }
];

export const rules: Rule[] = [...baseRules];
