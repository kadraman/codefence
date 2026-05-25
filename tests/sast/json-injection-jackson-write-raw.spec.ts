import assert from "node:assert/strict";
import test from "node:test";
import { rule } from "../../src/rules/sast/rulejsonInjectionJacksonWriteRaw";

test("json-injection-jackson-write-raw: flags vulnerable patterns", () => {
  assert.ok(rule.test("generator.writeRaw(\"\\\"value\\\": \" + userInput)"), "should flag generator.writeRaw with concatenated JSON");
  assert.ok(rule.test("gen.writeRaw(rawJson)"), "should flag gen.writeRaw(rawJson)");
});

test("json-injection-jackson-write-raw: allows safe patterns", () => {
  assert.ok(!rule.test("generator.writeString(value)"), "should not flag generator.writeString(value)");
  assert.ok(!rule.test("generator.writeStringField(\"key\", value)"), "should not flag generator.writeStringField");
});
