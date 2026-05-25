import assert from "node:assert/strict";
import test from "node:test";
import { rule } from "../../src/rules/sast/rulecookieSecuritySecureNotSet";

test("cookie-security-secure-not-set: flags vulnerable patterns", () => {
  assert.ok(rule.test("Cookie cookie = new Cookie(\"session\", sessionId);"), "should flag Cookie without Secure flag");
  assert.ok(rule.test("new Cookie(\"token\", value)"), "should flag new Cookie without Secure flag");
  assert.ok(rule.test("cookie.setSecure(false);"), "should flag cookie.setSecure(false);");
});

test("cookie-security-secure-not-set: allows safe patterns", () => {
  assert.ok(!rule.test("cookie.setSecure(true);"), "should not flag: cookie.setSecure(true);");
  assert.ok(!rule.test("response.addCookie(cookie);"), "should not flag: response.addCookie(cookie);");
});
