import assert from "node:assert/strict";
import test from "node:test";
import { rule } from "../../src/rules/sast/rulexxeTransformerFactory";

test("xxe-transformer-factory: flags vulnerable patterns", () => {
  assert.ok(rule.test("TransformerFactory tf = TransformerFactory.newInstance();"), "should flag: TransformerFactory tf = TransformerFactory.newInst");
  assert.ok(rule.test("private final TransformerFactory tf = TransformerFactory.newInstance();"), "should flag: private final TransformerFactory tf = TransformerF");
});

test("xxe-transformer-factory: allows safe patterns", () => {
  assert.ok(!rule.test("tf.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);"), "should not flag: tf.setFeature(XMLConstants.FEATURE_SECURE_PROCESSI");
  assert.ok(!rule.test("new DocumentBuilderFactory()"), "should not flag: new DocumentBuilderFactory()");
});
