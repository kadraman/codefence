import { createSqlInjectionRule } from "./sqlInjection";

// SQL Injection via java.sql.Statement with dynamic SQL

export const rule = createSqlInjectionRule({
  id: "sast-sql-injection-jdbc-statement",
  description: "SQL Injection via java.sql.Statement: dynamic SQL with string concatenation",
  methodCallPattern: /\.(execute|executeQuery|executeUpdate)\s*\(/,
  message:
    "[SAST] SQL Injection: use PreparedStatement with parameterized queries instead of Statement.execute/executeQuery/executeUpdate with string concatenation."
});
