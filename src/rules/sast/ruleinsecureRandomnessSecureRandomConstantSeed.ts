import { Rule } from "../../types";

// ============================================================
// ============================================================
// Insecure Randomness: SecureRandom initialized or seeded with a constant value
// Cannot detect constant final fields passed as seed (requires type analysis).
// is a Literal or a FieldAccess on a final field.
const secureRandomConstantSeed =
  /\bnew\s+SecureRandom\s*\(\s*(?:\d+[lL]?|"[^"]*"|'[^']*'|[A-Z_][A-Z0-9_]*)\s*\)|\.setSeed\s*\(\s*(?:\d+[lL]?|[A-Z_][A-Z0-9_]*)\s*\)/;

export const rule: Rule = {
  id: "sast-insecure-randomness-secure-random-constant-seed",
  description: "Insecure Randomness: SecureRandom initialized or seeded with a constant value",
  severity: "high",
  test: (line: string): boolean => secureRandomConstantSeed.test(line),
  message:
    "[SAST] Insecure Randomness: do not seed SecureRandom with a constant or hardcoded value."
};
