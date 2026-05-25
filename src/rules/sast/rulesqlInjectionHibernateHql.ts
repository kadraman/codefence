import { createSqlInjectionRule } from "./sqlInjection";

// SQL Injection via Hibernate Session.createQuery() with dynamic HQL

export const rule = createSqlInjectionRule({
  id: "sast-sql-injection-hibernate-hql",
  description: "SQL Injection (Hibernate HQL): Session.createQuery() with dynamic string concatenation",
  methodCallPattern: /\.createQuery\s*\(/,
  receiverPattern: /\b(session|Session)\s*\.\s*createQuery\s*\(/,
  message:
    "[SAST] SQL Injection: avoid dynamic HQL in Session.createQuery(); use named/positional parameters."
});
