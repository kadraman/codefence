import { createSqlInjectionRule } from "./sqlInjection";

// SQL Injection via Spring JdbcTemplate with dynamic SQL

export const rule = createSqlInjectionRule({
  id: "sast-sql-injection-jdbc-template",
  description: "SQL Injection via Spring JdbcTemplate: dynamic SQL with string concatenation",
  methodCallPattern: /\.(query|update|queryForList|queryForMap|queryForObject|queryForRowSet|queryForStream)\s*\(/,
  message:
    "[SAST] SQL Injection: use parameterized queries instead of string concatenation with JdbcTemplate."
});
