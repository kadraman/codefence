import assert from "node:assert/strict";
import test from "node:test";
import { rule as cookieHttpOnlyRule } from "../../src/rules/sast/rulecookieSecurityHttponlyNotSet";
import { rule as documentBuilderRule } from "../../src/rules/sast/rulexxeDocumentBuilderFactory";
import { rule as transformerRule } from "../../src/rules/sast/rulexxeTransformerFactory";
import { getMethodBlockLines } from "../../src/rules/sast/methodBlock";
import { matchesHardeningRule } from "../../src/rules/sast/hardeningContext";
import { LineScanContext } from "../../src/types";

const cookieConfig = {
  id: "test-cookie",
  description: "test",
  message: "test",
  severity: "high" as const,
  triggerPattern: /\bnew\s+Cookie\s*\(/,
  alwaysFlagPattern: /\.setHttpOnly\s*\(\s*false\s*\)/,
  hardeningChecks: (receiver: string | null) => {
    const scoped = receiver ? `\\b${receiver}\\s*\\.` : "\\.";
    return [new RegExp(`${scoped}setHttpOnly\\s*\\(\\s*true\\s*\\)`)];
  },
  extractReceiver: (line: string) => {
    const match = /\bCookie\s+(\w+)\s*=\s*new\b/.exec(line);
    return match?.[1] ?? null;
  }
};

test("matchesHardeningRule flags new Cookie without setHttpOnly in method block", () => {
  const lines = [
    "void bad() {",
    '  Cookie session = new Cookie("id", value);',
    "  response.addCookie(session);",
    "}"
  ];
  const context: LineScanContext = {
    priorLines: [],
    followingLines: lines.slice(2),
    methodBlockLines: getMethodBlockLines(lines, 1)
  };

  assert.equal(matchesHardeningRule(lines[1], context, cookieConfig), true);
});

test("matchesHardeningRule allows new Cookie when setHttpOnly(true) is in the method block", () => {
  const lines = [
    "void good() {",
    '  Cookie session = new Cookie("id", value);',
    "  session.setHttpOnly(true);",
    "  response.addCookie(session);",
    "}"
  ];
  const context: LineScanContext = {
    priorLines: [],
    followingLines: lines.slice(2),
    methodBlockLines: getMethodBlockLines(lines, 1)
  };

  assert.equal(matchesHardeningRule(lines[1], context, cookieConfig), false);
});

test("documentBuilder rule allows newInstance when setExpandEntityReferences is configured", () => {
  const lines = [
    "void parse() throws Exception {",
    "  DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();",
    "  dbf.setExpandEntityReferences(false);",
    "  dbf.newDocumentBuilder();",
    "}"
  ];
  const trigger = lines[1];
  const context: LineScanContext = {
    priorLines: [],
    followingLines: lines.slice(2),
    methodBlockLines: getMethodBlockLines(lines, 1)
  };

  assert.equal(documentBuilderRule.testWithWindow?.(trigger, context), false);
});

test("transformer rule allows newInstance when FEATURE_SECURE_PROCESSING is set", () => {
  const lines = [
    "void transform() throws Exception {",
    "  TransformerFactory tf = TransformerFactory.newInstance();",
    "  tf.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);",
    "  tf.newTransformer();",
    "}"
  ];
  const trigger = lines[1];
  const context: LineScanContext = {
    priorLines: [],
    followingLines: lines.slice(2),
    methodBlockLines: getMethodBlockLines(lines, 1)
  };

  assert.equal(transformerRule.testWithWindow?.(trigger, context), false);
});

test("cookie rule still flags setHttpOnly(false) on the same line", () => {
  assert.ok(cookieHttpOnlyRule.test("cookie.setHttpOnly(false);"));
});
