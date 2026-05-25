import assert from "node:assert/strict";
import test from "node:test";
import { rule } from "../../src/rules/sast/rulexxeDocumentBuilderFactory";

test("xxe-document-builder-factory: flags vulnerable patterns", () => {
  assert.ok(rule.test("DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();"), "should flag: DocumentBuilderFactory dbf = DocumentBuilderFactor");
  assert.ok(rule.test("private static final DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();"), "should flag: private static final DocumentBuilderFactory dbf = ");
});

test("xxe-document-builder-factory: allows safe patterns", () => {
  assert.ok(!rule.test("dbf.setExpandEntityReferences(false);"), "should not flag: dbf.setExpandEntityReferences(false);");
  assert.ok(!rule.test("new SAXParserFactory()"), "should not flag: new SAXParserFactory()");
});
