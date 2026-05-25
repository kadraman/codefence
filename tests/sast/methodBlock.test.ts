import assert from "node:assert/strict";
import test from "node:test";
import { getMethodBlockLines } from "../../src/rules/sast/methodBlock";

test("getMethodBlockLines returns the enclosing method body", () => {
  const lines = [
    "public class Demo {",
    "  void vulnerable(String id) {",
    '    String sql = "SELECT " + id;',
    "    jdbc.query(sql);",
    "  }",
    "}"
  ];

  const block = getMethodBlockLines(lines, 3);
  assert.deepEqual(block, [
    "  void vulnerable(String id) {",
    '    String sql = "SELECT " + id;',
    "    jdbc.query(sql);",
    "  }"
  ]);
});

test("getMethodBlockLines includes nested blocks inside the same method", () => {
  const lines = [
    "void outer() {",
    "  if (ready) {",
    "    Cookie cookie = new Cookie(\"a\", \"b\");",
    "    cookie.setHttpOnly(true);",
    "  }",
    "}"
  ];

  const block = getMethodBlockLines(lines, 2);
  assert.ok(block.some((line) => line.includes("new Cookie")));
  assert.ok(block.some((line) => line.includes("setHttpOnly(true)")));
});
