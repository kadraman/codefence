import assert from "node:assert/strict";
import test from "node:test";
import { parseAspectList, parseScanArgv, resolveAspects } from "../src/scan/parseOptions";

test("parseScanArgv errors when value-taking flags are missing a value", () => {
  assert.throws(() => parseScanArgv(["--only"]), /--only requires a value/);
  assert.throws(() => parseScanArgv(["--only", "--staged"]), /--only requires a value/);
  assert.throws(() => parseScanArgv(["--only="]), /--only requires a value/);
  assert.throws(() => parseScanArgv(["--skip"]), /--skip requires a value/);
  assert.throws(() => parseScanArgv(["--skip", "-h"]), /--skip requires a value/);
});

test("parseScanArgv recognizes -h and --help", () => {
  assert.deepEqual(parseScanArgv(["-h"]), { help: true });
  assert.deepEqual(parseScanArgv(["--help"]), { help: true });
  assert.deepEqual(parseScanArgv(["--staged", "-h"]), { help: true });
});

test("parseAspectList accepts code only", () => {
  assert.deepEqual(parseAspectList("code"), ["code"]);
});

test("resolveAspects defaults to code", () => {
  const aspects = resolveAspects({
    staged: false,
    paths: [],
    only: null,
    skip: []
  });
  assert.deepEqual(aspects, ["code"]);
});

test("resolveAspects honors --only and --skip", () => {
  const aspects = resolveAspects({
    staged: false,
    paths: [],
    only: ["code"],
    skip: ["code"]
  });
  assert.deepEqual(aspects, []);
});
