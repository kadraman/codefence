import { Rule } from "../../types";

// ============================================================
// ============================================================
// JSON Injection via Jackson JsonGenerator.writeRaw() with unsanitized input
// Conservative: writeRaw() is rarely safe with user-controlled input.
const jacksonWriteRaw = /\.writeRaw\s*\(/;

export const rule: Rule = {
  id: "sast-json-injection-jackson-write-raw",
  description: "JSON Injection via Jackson JsonGenerator.writeRaw() with potentially unsanitized input",
  severity: "high",
  test: (line: string): boolean => jacksonWriteRaw.test(line),
  message:
    "[SAST] JSON Injection: avoid JsonGenerator.writeRaw() with user-controlled input; use writeString() or proper escaping."
};
