import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { CLI_NAME, cliInvocation } from "../src/cliName";

const cliJs = path.resolve(__dirname, "..", "src", "cli.js");

test("CLI_NAME is codefence", () => {
  assert.equal(CLI_NAME, "codefence");
});

test("cliInvocation formats subcommands", () => {
  assert.equal(cliInvocation("scan", "--staged"), "codefence scan --staged");
});

test("compiled CLI help output describes local code scan only", () => {
  const result = spawnSync(process.execPath, [cliJs, "scan", "--help"], {
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, /codefence scan/);
  assert.match(output, /Local secure-coding/);
  assert.match(output, /--secret-rules/);
  assert.match(output, /--secret-min-confidence/);
});
