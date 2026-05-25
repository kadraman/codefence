import assert from "node:assert/strict";
import test from "node:test";
import { rule } from "../../src/rules/sast/rulesqlInjectionHibernateNativeQuery";

test("sql-injection-hibernate-native-query: flags vulnerable patterns", () => {
  assert.ok(rule.test("session.createNativeQuery(\"SELECT * FROM users WHERE id=\\'\" + id + \"\\'\")"), "should flag createNativeQuery with concatenated SQL");
  assert.ok(rule.test("var q = session.createNativeQuery(\"DELETE FROM \" + tableName)"), "should flag createNativeQuery with table name concatenation");
});

test("sql-injection-hibernate-native-query: allows safe patterns", () => {
  assert.ok(!rule.test("session.createNativeQuery(\"SELECT * FROM users WHERE id=?1\")"), "should not flag parameterized createNativeQuery");
  assert.ok(!rule.test("session.createNativeQuery(\"SELECT * FROM users\")"), "should not flag static createNativeQuery");
});
