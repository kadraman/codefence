import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { installAssistantRules } from "../src/install/assistantRules";
import { MARKER_START } from "../src/install/markers";

describe("installAssistantRules integration", () => {
  it("merges into existing AGENTS.md without removing custom content", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "codefence-install-"));
    const agents = path.join(tmp, "AGENTS.md");
    fs.writeFileSync(agents, "# Team rules\n\nDo not delete me.\n", "utf8");

    const results = installAssistantRules({ cwd: tmp });
    const agentsResult = results.find((r) => r.path === "AGENTS.md");
    assert.ok(agentsResult);
    assert.notEqual(agentsResult?.action, "unchanged");

    const content = fs.readFileSync(agents, "utf8");
    assert.match(content, /Do not delete me/);
    assert.ok(content.includes(MARKER_START));
    assert.ok(fs.existsSync(path.join(tmp, ".cursor", "rules", "sast-guardrails.mdc")));

    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
