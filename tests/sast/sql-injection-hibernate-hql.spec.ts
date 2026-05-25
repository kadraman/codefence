import assert from "node:assert/strict";
import test from "node:test";
import { rule } from "../../src/rules/sast/rulesqlInjectionHibernateHql";

test("sql-injection-hibernate-hql: flags vulnerable patterns", () => {
  assert.ok(rule.test("session.createQuery(\"FROM User WHERE name=\\'\" + name + \"\\'\")"), "should flag session.createQuery with concatenated HQL");
  assert.ok(rule.test("session.createQuery(\"SELECT * FROM Item WHERE owner=\\'\" + owner + \"\\'\")"), "should flag session.createQuery with concatenated SQL");
});

test("sql-injection-hibernate-hql: allows safe patterns", () => {
  assert.ok(!rule.test("session.createQuery(\"FROM User WHERE name=:name\")"), "should not flag named-parameter session.createQuery");
  assert.ok(!rule.test("session.createQuery(\"FROM User WHERE name=?1\")"), "should not flag positional-parameter session.createQuery");
});
