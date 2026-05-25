import assert from "node:assert/strict";
import test from "node:test";
import { rule } from "../../src/rules/sast/ruleinsecureRandomnessJavaUtilRandom";

test("insecure-randomness-java-util-random: flags vulnerable patterns", () => {
  assert.ok(rule.test("Random rng = new Random();"), "should flag: Random rng = new Random();");
  assert.ok(rule.test("java.util.Random r = new java.util.Random(42);"), "should flag: java.util.Random r = new java.util.Random(42);");
  assert.ok(rule.test("new Random(System.currentTimeMillis())"), "should flag: new Random(System.currentTimeMillis())");
});

test("insecure-randomness-java-util-random: allows safe patterns", () => {
  assert.ok(!rule.test("SecureRandom sr = new SecureRandom();"), "should not flag: SecureRandom sr = new SecureRandom();");
  assert.ok(!rule.test("new java.security.SecureRandom()"), "should not flag: new java.security.SecureRandom()");
});
