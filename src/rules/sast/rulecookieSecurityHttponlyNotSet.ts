import { createHardeningRule, extractCookieReceiver } from "./hardeningContext";


export const rule = createHardeningRule({
  id: "sast-cookie-security-httponly-not-set",
  description: "Cookie Security: Cookie created — verify HttpOnly flag is set to true",
  severity: "high",
  triggerPattern: /\bnew\s+(?:jakarta\.servlet\.http\.)?Cookie\s*\(/,
  alwaysFlagPattern: /\.setHttpOnly\s*\(\s*false\s*\)/,
  extractReceiver: extractCookieReceiver,
  hardeningChecks: (receiver) => {
    const scoped = receiver ? `\\b${receiver}\\s*\\.` : "\\.";
    return [new RegExp(`${scoped}setHttpOnly\\s*\\(\\s*true\\s*\\)`)];
  },
  message:
    "[SAST] Cookie Security: call cookie.setHttpOnly(true) after creating a Cookie."
});
