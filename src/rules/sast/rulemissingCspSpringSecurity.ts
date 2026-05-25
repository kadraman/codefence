import { Rule } from "../../types";

// ============================================================
// ============================================================
// Missing Content Security Policy in Spring Security configuration
// in the method body from a single line. Flags the configure(HttpSecurity) method signature
// to prompt review. Developers must manually verify that contentSecurityPolicy() is called.
// WebSecurityConfigurerAdapter subclass that does NOT call contentSecurityPolicy().
const springSecurityConfigure =
  /\bconfigure\s*\(\s*(?:final\s+)?(?:org\.springframework\.security\.config\.annotation\.web\.builders\.)?HttpSecurity\b/;

export const rule: Rule = {
  id: "sast-missing-csp-spring-security",
  description: "Missing CSP: configure(HttpSecurity) method detected — verify contentSecurityPolicy() is configured",
  severity: "high",
  test: (line: string): boolean => springSecurityConfigure.test(line),
  message:
    "[SAST] Missing CSP: ensure http.headers().contentSecurityPolicy(...) is configured in this method."
};
