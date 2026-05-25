import { createSqlInjectionRule } from "./sqlInjection";

// SQL Injection via JPA EntityManager.createQuery() with dynamic JPQL

export const rule = createSqlInjectionRule({
  id: "sast-sql-injection-jpa-create-query",
  description: "SQL Injection (JPQL) via JPA EntityManager.createQuery() with dynamic string concatenation",
  methodCallPattern: /\.createQuery\s*\(/,
  receiverPattern: /\b(entityManager|EntityManager|em)\s*\.\s*createQuery\s*\(/,
  message:
    "[SAST] SQL Injection: avoid dynamic JPQL in EntityManager.createQuery(); use named parameters (:param) instead."
});
