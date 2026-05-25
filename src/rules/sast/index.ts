import { Rule } from "../../types";

// Line-based SAST rules for Java (translated from enterprise rule packs).

import { rule as rulesqlInjectionJdbcTemplate } from "./rulesqlInjectionJdbcTemplate";
import { rule as rulesqlInjectionJdbcStatement } from "./rulesqlInjectionJdbcStatement";
import { rule as rulesqlInjectionHibernateNativeQuery } from "./rulesqlInjectionHibernateNativeQuery";
import { rule as rulesqlInjectionHibernateHql } from "./rulesqlInjectionHibernateHql";
import { rule as rulesqlInjectionJpaCreateNativeQuery } from "./rulesqlInjectionJpaCreateNativeQuery";
import { rule as rulesqlInjectionJpaCreateQuery } from "./rulesqlInjectionJpaCreateQuery";
import { rule as rulexxeDocumentBuilderFactory } from "./rulexxeDocumentBuilderFactory";
import { rule as rulexxeTransformerFactory } from "./rulexxeTransformerFactory";
import { rule as rulejsonInjectionJacksonWriteRaw } from "./rulejsonInjectionJacksonWriteRaw";
import { rule as ruleinsecureRandomnessJavaUtilRandom } from "./ruleinsecureRandomnessJavaUtilRandom";
import { rule as ruleinsecureRandomnessSecureRandomConstantSeed } from "./ruleinsecureRandomnessSecureRandomConstantSeed";
import { rule as rulecookieSecurityHttponlyNotSet } from "./rulecookieSecurityHttponlyNotSet";
import { rule as rulecookieSecuritySecureNotSet } from "./rulecookieSecuritySecureNotSet";
import { rule as rulemissingCspSpringSecurity } from "./rulemissingCspSpringSecurity";

export const sastRules: Rule[] = [
  rulesqlInjectionJdbcTemplate,
  rulesqlInjectionJdbcStatement,
  rulesqlInjectionHibernateNativeQuery,
  rulesqlInjectionHibernateHql,
  rulesqlInjectionJpaCreateNativeQuery,
  rulesqlInjectionJpaCreateQuery,
  rulexxeDocumentBuilderFactory,
  rulexxeTransformerFactory,
  rulejsonInjectionJacksonWriteRaw,
  ruleinsecureRandomnessJavaUtilRandom,
  ruleinsecureRandomnessSecureRandomConstantSeed,
  rulecookieSecurityHttponlyNotSet,
  rulecookieSecuritySecureNotSet,
  rulemissingCspSpringSecurity
];
