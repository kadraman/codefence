import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { getValidCodeCache, writeCodeCache } from "../src/hooks/cache";
import { DebounceTracker } from "../src/hooks/debounce";
import { normalizeRelativePath } from "../src/hooks/paths";

describe("hooks cache", () => {
  it("invalidates cache when mtime changes", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-cache-"));
    const file = path.join(tmp, "a.ts");
    fs.writeFileSync(file, "const x = 1;\n", "utf8");

    writeCodeCache(tmp, "a.ts", []);
    assert.ok(getValidCodeCache(tmp, "a.ts"));

    fs.appendFileSync(file, "\n");
    assert.equal(getValidCodeCache(tmp, "a.ts"), null);

    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe("hooks debounce", () => {
  it("releases files after debounce window", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-debounce-"));
    const tracker = new DebounceTracker(tmp, 0.05);
    tracker.addFile("src/foo.ts");

    assert.equal(tracker.getFilesReadyToScan().length, 0);

    const start = Date.now();
    while (Date.now() - start < 200) {
      const ready = tracker.getFilesReadyToScan();
      if (ready.length > 0) {
        assert.equal(normalizeRelativePath(tmp, ready[0]), "src/foo.ts");
        fs.rmSync(tmp, { recursive: true, force: true });
        return;
      }
    }

    fs.rmSync(tmp, { recursive: true, force: true });
    assert.fail("expected file to become ready after debounce");
  });
});
