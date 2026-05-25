import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractMarkedBlock,
  hasMarkedBlock,
  mergeMarkedBlock,
  MARKER_END,
  MARKER_START
} from "../src/install/markers";

describe("mergeMarkedBlock", () => {
  const fragment = `${MARKER_START}\ncodefence body\n${MARKER_END}`;

  it("creates content from empty string", () => {
    const { content, action } = mergeMarkedBlock("", fragment);
    assert.equal(action, "created");
    assert.ok(hasMarkedBlock(content));
  });

  it("appends when file exists without markers", () => {
    const { content, action } = mergeMarkedBlock("# My rules\n\nKeep this.\n", fragment);
    assert.equal(action, "appended");
    assert.match(content, /Keep this/);
    assert.ok(hasMarkedBlock(content));
  });

  it("updates only the marked section", () => {
    const existing = `# Title\n\n${MARKER_START}\nold\n${MARKER_END}\n\nTail.`;
    const nextFragment = `${MARKER_START}\nnew\n${MARKER_END}`;
    const { content, action } = mergeMarkedBlock(existing, nextFragment);
    assert.equal(action, "updated");
    assert.match(content, /Tail\./);
    assert.match(content, /new/);
    assert.doesNotMatch(content, /old/);
  });

  it("returns unchanged when block is identical", () => {
    const existing = `prefix\n${fragment}\n`;
    const { action } = mergeMarkedBlock(existing, fragment);
    assert.equal(action, "unchanged");
  });

  it("extractMarkedBlock returns the block", () => {
    const block = extractMarkedBlock(`x ${fragment} y`);
    assert.ok(block?.includes("codefence body"));
  });

  it("normalizes legacy codefence markers on update", () => {
    const legacy = `# Title\n\n<!-- codefence:start -->\nold\n<!-- codefence:end -->\n`;
    const { content, action } = mergeMarkedBlock(legacy, fragment);
    assert.equal(action, "updated");
    assert.ok(hasMarkedBlock(content));
    assert.doesNotMatch(content, /codefence:start/);
    assert.ok(content.includes("codefence body"));
  });
});
