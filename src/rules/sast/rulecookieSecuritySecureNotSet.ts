import { createHardeningRule, extractCookieReceiver } from "./hardeningContext";


export const rule = createHardeningRule({
  id: "sast-cookie-security-secure-not-set",
  description: "Cookie Security: Cookie created — verify Secure flag is set to true",
  severity: "low",
  triggerPattern: /\bnew\s+(?:jakarta\.servlet\.http\.)?Cookie\s*\(/,
  alwaysFlagPattern: /\.setSecure\s*\(\s*false\s*\)/,
  extractReceiver: extractCookieReceiver,
  hardeningChecks: (receiver) => {
    const scoped = receiver ? `\\b${receiver}\\s*\\.` : "\\.";
    return [new RegExp(`${scoped}setSecure\\s*\\(\\s*true\\s*\\)`)];
  },
  message:
    "[SAST] Cookie Security: call cookie.setSecure(true) after creating a Cookie to ensure it is only sent over HTTPS."
});
