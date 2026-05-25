import assert from "node:assert/strict";
import test from "node:test";
import { rule as jdbcTemplateRule } from "../../src/rules/sast/rulesqlInjectionJdbcTemplate";
import { rule as hibernateNativeRule } from "../../src/rules/sast/rulesqlInjectionHibernateNativeQuery";
import { rule as jpaNativeRule } from "../../src/rules/sast/rulesqlInjectionJpaCreateNativeQuery";
import {
  extractFirstArgIdentifier,
  hasDynamicSqlAssignment,
  matchesSqlInjection
} from "../../src/rules/sast/sqlInjection";

const jdbcConfig = {
  id: "test-jdbc-template",
  description: "test",
  message: "test",
  methodCallPattern: /\.query\s*\(/
};

test("extractFirstArgIdentifier reads simple variable arguments", () => {
  assert.equal(
    extractFirstArgIdentifier('jdbcTemplate.query(sql, mapper);', jdbcConfig.methodCallPattern),
    "sql"
  );
});

test("hasDynamicSqlAssignment finds concatenation in the sliding window", () => {
  const prior = [
    "public void run(String id) {",
    '  String sql = "SELECT * FROM users WHERE id=\'" + id + "\'";'
  ];
  assert.equal(hasDynamicSqlAssignment("sql", prior), true);
});

test("hasDynamicSqlAssignment finds assignments split across prior lines", () => {
  const prior = ['  String sql = "SELECT * FROM users WHERE id=\'" +', "    id + \"'\";"];
  assert.equal(hasDynamicSqlAssignment("sql", prior), true);
});

test("matchesSqlInjection flags call sites fed by earlier dynamic SQL variables", () => {
  const callLine = "    jdbcTemplate.query(sql, rowMapper);";
  const context = {
    priorLines: ['  String sql = "SELECT * FROM users WHERE id=\'" + userId + "\'";'],
    followingLines: [],
    methodBlockLines: []
  };

  assert.equal(matchesSqlInjection(callLine, context, jdbcConfig), true);
});

test("matchesSqlInjection ignores parameterized assignments in the window", () => {
  const callLine = "    jdbcTemplate.query(sql, userId);";
  const context = {
    priorLines: ['  String sql = "SELECT * FROM users WHERE id=?";'],
    followingLines: [],
    methodBlockLines: []
  };

  assert.equal(matchesSqlInjection(callLine, context, jdbcConfig), false);
});

test("jdbcTemplate rule still flags inline concatenation", () => {
  assert.ok(
    jdbcTemplateRule.test(
      'jdbcTemplate.queryForList("SELECT * FROM users WHERE id=\'" + userId + "\'")'
    )
  );
});

test("jdbcTemplate rule flags variable arguments via testWithWindow", () => {
  assert.ok(
    jdbcTemplateRule.testWithWindow?.("jdbcTemplate.query(sql, mapper);", {
      priorLines: ['String sql = "SELECT * FROM users WHERE id=\'" + userId + "\'";'],
      followingLines: [],
      methodBlockLines: [
        "void run() {",
        'String sql = "SELECT * FROM users WHERE id=\'" + userId + "\'";',
        "jdbcTemplate.query(sql, mapper);",
        "}"
      ]
    })
  );
});

test("hibernate native rule does not fire on EntityManager call sites", () => {
  assert.equal(
    hibernateNativeRule.testWithWindow?.("em.createNativeQuery(sql);", {
      priorLines: ['String sql = "SELECT * FROM users WHERE id=\'" + id + "\'";'],
      followingLines: [],
      methodBlockLines: []
    }),
    false
  );
});

test("jpa native rule fires on EntityManager call sites with prior dynamic SQL", () => {
  assert.equal(
    jpaNativeRule.testWithWindow?.("entityManager.createNativeQuery(sql);", {
      priorLines: ['String sql = "SELECT * FROM users WHERE id=\'" + id + "\'";'],
      followingLines: [],
      methodBlockLines: []
    }),
    true
  );
});
