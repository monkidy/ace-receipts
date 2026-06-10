import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const cli = path.resolve("dist/src/cli.js");

function run(args: string[], input?: string) {
  return spawnSync(process.execPath, [cli, ...args], { input, encoding: "utf8" });
}

test("exit code 0 on PASS (safe workflow)", () => {
  const r = run(["check", "--file", "examples/safe-workflow.yml"]);
  assert.equal(r.status, 0);
  assert.ok(r.stdout.includes("ACE RECEIPT: PASS"));
  assert.ok(r.stdout.includes("Proof opens the gate."));
});

test("exit code 1 on HOLD (demo)", () => {
  const r = run(["demo"]);
  assert.equal(r.status, 1);
  assert.ok(r.stdout.includes("ACE RECEIPT: HOLD"));
  assert.ok(r.stdout.includes("Not yet. Bring receipts."));
  assert.ok(r.stdout.includes("No receipt, no passage."));
});

test("exit code 2 on FAIL (vulnerable workflow)", () => {
  const r = run(["check", "--file", "examples/vulnerable-workflow.yml"]);
  assert.equal(r.status, 2);
  assert.ok(r.stdout.includes("ACE RECEIPT: FAIL"));
  assert.ok(r.stdout.includes("Vibes shall not pass."));
});

test("exit code 2 on FAIL (risky diff on stdin)", () => {
  const input = fs.readFileSync("examples/risky-ai-pr.diff", "utf8");
  const r = run(["check", "--diff"], input);
  assert.equal(r.status, 2);
  assert.ok(r.stdout.includes("ACE RECEIPT: FAIL"));
});

test("check without --diff or --file fails closed", () => {
  const r = run(["check"]);
  assert.equal(r.status, 2);
});

test("receipts are written to .ace/receipts", () => {
  run(["demo"]);
  const md = fs.readFileSync(".ace/receipts/latest.md", "utf8");
  const json = JSON.parse(fs.readFileSync(".ace/receipts/latest.json", "utf8")) as {
    verdict: string;
    command: string;
  };
  assert.ok(md.includes("ACE Receipt: HOLD"));
  assert.equal(json.verdict, "hold");
  assert.equal(json.command, "demo");
});
