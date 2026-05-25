import { Rule } from "../../types";

// ============================================================
// ============================================================
// Insecure Randomness: use of java.util.Random
const javaUtilRandom = /\bnew\s+(?:java\.util\.)?Random\s*\(/;

export const rule: Rule = {
  id: "sast-insecure-randomness-java-util-random",
  description: "Insecure Randomness: java.util.Random is not cryptographically secure",
  severity: "high",
  test: (line: string): boolean => javaUtilRandom.test(line),
  message:
    "[SAST] Insecure Randomness: replace java.util.Random with java.security.SecureRandom for security-sensitive operations."
};
