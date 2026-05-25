import assert from "node:assert/strict";
import test from "node:test";
import { rule } from "../../src/rules/sast/rulesqlInjectionJpaCreateQuery";

test("sql-injection-jpa-create-query: flags vulnerable patterns", () => {
  assert.ok(rule.test("em.createQuery(\"SELECT u FROM User u WHERE u.name=\\'\" + name + \"\\'\")"), "should flag em.createQuery with concatenated JPQL");
  assert.ok(rule.test("entityManager.createQuery(\"FROM Item WHERE owner=\\'\" + owner + \"\\'\")"), "should flag entityManager.createQuery with concatenated HQL");
});

test("sql-injection-jpa-create-query: allows safe patterns", () => {
  assert.ok(!rule.test("em.createQuery(\"SELECT u FROM User u WHERE u.name=:name\")"), "should not flag named-parameter em.createQuery");
  assert.ok(!rule.test("entityManager.createQuery(\"SELECT u FROM User u\")"), "should not flag static entityManager.createQuery");
});
