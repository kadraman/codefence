import assert from "node:assert/strict";
import test from "node:test";
import { rule } from "../../src/rules/sast/rulecookieSecurityHttponlyNotSet";

test("cookie-security-httponly-not-set: flags vulnerable patterns", () => {
  assert.ok(rule.test("Cookie cookie = new Cookie(\"session\", sessionId);"), "should flag Cookie without HttpOnly");
  assert.ok(rule.test("new jakarta.servlet.http.Cookie(\"token\", value)"), "should flag jakarta Cookie without HttpOnly");
  assert.ok(rule.test("cookie.setHttpOnly(false);"), "should flag cookie.setHttpOnly(false);");
});

test("cookie-security-httponly-not-set: allows safe patterns", () => {
  assert.ok(!rule.test("cookie.setHttpOnly(true);"), "should not flag: cookie.setHttpOnly(true);");
  assert.ok(!rule.test("response.addCookie(cookie);"), "should not flag: response.addCookie(cookie);");
});
