import assert from "node:assert/strict";
import test from "node:test";
import { rule } from "../../src/rules/sast/rulesqlInjectionJdbcTemplate";

test("sql-injection-jdbc-template: flags vulnerable patterns", () => {
  assert.ok(rule.test("jdbcTemplate.queryForList(\"SELECT * FROM users WHERE id=\\'\" + userId + \"\\'\")"), "should flag jdbcTemplate.queryForList with concatenated SQL");
  assert.ok(rule.test("template.update(\"INSERT INTO logs VALUES(\\'\" + logData + \"\\'\")"), "should flag template.update with concatenated SQL");
  assert.ok(rule.test("this.jdbcTemplate.query(\"SELECT * FROM items WHERE name=\\'\" + name + \"\\'\", mapper)"), "should flag jdbcTemplate.query with concatenated SQL");
});

test("sql-injection-jdbc-template: allows safe patterns", () => {
  assert.ok(!rule.test("jdbcTemplate.queryForList(\"SELECT * FROM users WHERE id=?\", userId)"), "should not flag parameterized jdbcTemplate.queryForList");
  assert.ok(!rule.test("jdbcTemplate.queryForList(\"SELECT * FROM users\")"), "should not flag static jdbcTemplate.queryForList");
  assert.ok(!rule.test("stmt.executeQuery(\"SELECT * FROM items\")"), "should not flag static stmt.executeQuery");
});
