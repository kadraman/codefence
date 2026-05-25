import assert from "node:assert/strict";
import test from "node:test";
import { rule } from "../../src/rules/sast/ruleinsecureRandomnessSecureRandomConstantSeed";

test("insecure-randomness-secure-random-constant-seed: flags vulnerable patterns", () => {
  assert.ok(rule.test("SecureRandom sr = new SecureRandom(1234L);"), "should flag: SecureRandom sr = new SecureRandom(1234L);");
  assert.ok(rule.test("new SecureRandom(FIXED_SEED)"), "should flag: new SecureRandom(FIXED_SEED)");
  assert.ok(rule.test("sr.setSeed(12345L)"), "should flag: sr.setSeed(12345L)");
  assert.ok(rule.test("sr.setSeed(SEED_CONSTANT)"), "should flag: sr.setSeed(SEED_CONSTANT)");
});

test("insecure-randomness-secure-random-constant-seed: allows safe patterns", () => {
  assert.ok(!rule.test("SecureRandom sr = new SecureRandom();"), "should not flag: SecureRandom sr = new SecureRandom();");
  assert.ok(!rule.test("new SecureRandom(trulyRandomBytes)"), "should not flag: new SecureRandom(trulyRandomBytes)");
  assert.ok(!rule.test("sr.setSeed(secureBytes)"), "should not flag: sr.setSeed(secureBytes)");
});
