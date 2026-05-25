import assert from "node:assert/strict";
import test from "node:test";
import { rule } from "../../src/rules/sast/rulesqlInjectionJpaCreateNativeQuery";

test("sql-injection-jpa-create-native-query: flags vulnerable patterns", () => {
  assert.ok(rule.test("entityManager.createNativeQuery(\"SELECT * FROM users WHERE id=\\'\" + id + \"\\'\")"), "should flag entityManager.createNativeQuery with concatenated SQL");
  assert.ok(rule.test("em.createNativeQuery(\"INSERT INTO \" + table + \" VALUES(?1)\")"), "should flag em.createNativeQuery with table concatenation");
});

test("sql-injection-jpa-create-native-query: allows safe patterns", () => {
  assert.ok(!rule.test("entityManager.createNativeQuery(\"SELECT * FROM users WHERE id=?1\")"), "should not flag parameterized entityManager.createNativeQuery");
  assert.ok(!rule.test("entityManager.createNativeQuery(\"SELECT * FROM users\")"), "should not flag static entityManager.createNativeQuery");
});
