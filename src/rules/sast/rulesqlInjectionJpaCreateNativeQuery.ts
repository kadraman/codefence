import { createSqlInjectionRule } from "./sqlInjection";

// SQL Injection via JPA EntityManager.createNativeQuery() with dynamic SQL

export const rule = createSqlInjectionRule({
  id: "sast-sql-injection-jpa-create-native-query",
  description: "SQL Injection via JPA EntityManager.createNativeQuery() with dynamic SQL",
  methodCallPattern: /\.createNativeQuery\s*\(/,
  receiverPattern: /\b(entityManager|EntityManager|em)\s*\.\s*createNativeQuery\s*\(/,
  message:
    "[SAST] SQL Injection: use parameterized native queries instead of string concatenation with EntityManager."
});
