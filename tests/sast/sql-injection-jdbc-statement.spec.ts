import assert from "node:assert/strict";
import test from "node:test";
import { rule } from "../../src/rules/sast/rulesqlInjectionJdbcStatement";

test("sql-injection-jdbc-statement: flags vulnerable patterns", () => {
  assert.ok(rule.test("st.executeQuery(\"SELECT * FROM users WHERE id=\\'\" + id + \"\\'\")"), "should flag st.executeQuery with concatenated SQL");
  assert.ok(rule.test("stmt.execute(\"DELETE FROM logs WHERE user=\\'\" + userName + \"\\'\")"), "should flag stmt.execute with concatenated SQL");
  assert.ok(rule.test("statement.executeUpdate(\"INSERT INTO items VALUES(\\'\" + item + \"\\'\")"), "should flag statement.executeUpdate with concatenated SQL");
});

test("sql-injection-jdbc-statement: allows safe patterns", () => {
  assert.ok(!rule.test("st.executeQuery(\"SELECT * FROM users WHERE id=?\")"), "should not flag parameterized st.executeQuery");
  assert.ok(!rule.test("PreparedStatement ps = conn.prepareStatement(\"SELECT * FROM users WHERE id=?\");"), "should not flag PreparedStatement usage");
});
