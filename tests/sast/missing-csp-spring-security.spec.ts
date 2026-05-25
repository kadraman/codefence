import assert from "node:assert/strict";
import test from "node:test";
import { rule } from "../../src/rules/sast/rulemissingCspSpringSecurity";

test("missing-csp-spring-security: flags vulnerable patterns", () => {
  assert.ok(rule.test("protected void configure(HttpSecurity http) throws Exception {"), "should flag: protected void configure(HttpSecurity http) throws");
  assert.ok(rule.test("public void configure(HttpSecurity http) throws Exception {"), "should flag: public void configure(HttpSecurity http) throws Ex");
  assert.ok(rule.test("protected void configure(final HttpSecurity http) throws Exception {"), "should flag: protected void configure(final HttpSecurity http) ");
});

test("missing-csp-spring-security: allows safe patterns", () => {
  assert.ok(!rule.test("protected void configure(AuthenticationManagerBuilder auth) throws Exception {"), "should not flag: protected void configure(AuthenticationManagerBuil");
  assert.ok(!rule.test("http.headers().contentSecurityPolicy(\"default-src 'self'\");"), "should not flag http.headers().contentSecurityPolicy");
});
