import { createSqlInjectionRule } from "./sqlInjection";

// SQL Injection via Hibernate Session.createNativeQuery() with dynamic SQL

export const rule = createSqlInjectionRule({
  id: "sast-sql-injection-hibernate-native-query",
  description: "SQL Injection via Hibernate Session.createNativeQuery() with dynamic SQL",
  methodCallPattern: /\.createNativeQuery\s*\(/,
  receiverPattern: /\b(session|Session)\s*\.\s*createNativeQuery\s*\(/,
  message:
    "[SAST] SQL Injection: use parameterized native queries (setParameter) instead of string concatenation."
});
