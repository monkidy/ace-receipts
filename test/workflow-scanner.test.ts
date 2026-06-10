import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { aggregate } from "../src/core/risk.js";
import { scanWorkflowContent } from "../src/scanners/workflow-scanner.js";

const read = (p: string): string => fs.readFileSync(path.resolve(p), "utf8");

test("vulnerable example workflow fails the gate", () => {
  const content = read("examples/vulnerable-workflow.yml");
  const res = scanWorkflowContent("examples/vulnerable-workflow.yml", content, false);

  assert.equal(res.isAI, true);
  const ids = res.findings.map((f) => f.id);
  assert.ok(ids.includes("wf.pull_request_target_with_ai"));
  assert.ok(ids.includes("wf.untrusted_input_with_ai"));
  assert.ok(ids.includes("wf.write_access_with_untrusted_input"));
  assert.ok(ids.includes("wf.secrets_with_untrusted_and_ai"));
  assert.ok(ids.includes("wf.unpinned_actions"));
  assert.ok(ids.includes("wf.provider_key_in_env"));

  const a = aggregate(res.findings);
  assert.equal(a.verdict, "fail");
  assert.equal(a.risk, "high");
  assert.equal(a.permission, "blocked");
});

test("safe example workflow passes the gate", () => {
  const content = read("examples/safe-workflow.yml");
  const res = scanWorkflowContent("examples/safe-workflow.yml", content, false);

  assert.equal(res.isAI, true);
  assert.deepEqual(res.findings, []);

  const a = aggregate(res.findings);
  assert.equal(a.verdict, "pass");
  assert.equal(a.gate, "pass");
  assert.equal(a.permission, "merge_allowed");
});

test("non AI workflow with no risky combination stays quiet", () => {
  const content = [
    "name: CI",
    "on:",
    "  push:",
    "permissions:",
    "  contents: read",
    "jobs:",
    "  build:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - run: npm test",
  ].join("\n");
  const res = scanWorkflowContent("ci.yml", content, false);
  assert.equal(res.isAI, false);
  assert.deepEqual(res.findings, []);
});
