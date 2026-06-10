import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { writeReceiptFiles } from "../src/core/output.js";
import { buildReceipt } from "../src/core/receipt.js";
import { exitCode } from "../src/core/risk.js";
import type { Finding } from "../src/types/receipt.js";

test("pass receipt: clean findings open the gate", () => {
  const r = buildReceipt({ command: "scan-workflows", summary: "ok", findings: [] });
  assert.equal(r.schema, "ace.receipt.v0");
  assert.equal(r.tool, "ace-receipts");
  assert.equal(r.verdict, "pass");
  assert.equal(r.gate, "pass");
  assert.equal(r.proof, "sufficient");
  assert.equal(r.risk, "low");
  assert.equal(r.permission, "merge_allowed");
  assert.equal(r.closeout, "ready");
  assert.equal(exitCode(r.verdict), 0);
});

test("hold receipt: medium findings hold the gate", () => {
  const findings: Finding[] = [
    { id: "wf.no_permissions_block", severity: "medium", impact: "hold", message: "m" },
  ];
  const r = buildReceipt({ command: "demo", summary: "s", findings });
  assert.equal(r.verdict, "hold");
  assert.equal(r.gate, "fail");
  assert.equal(r.proof, "partial");
  assert.equal(r.permission, "human_review_required");
  assert.equal(r.closeout, "pending");
  assert.ok(r.missing_receipts.length > 0);
  assert.ok(r.next.length > 0);
  assert.equal(exitCode(r.verdict), 1);
});

test("fail receipt: high findings block the gate", () => {
  const findings: Finding[] = [
    { id: "diff.secret_added", severity: "high", impact: "fail", message: "m" },
  ];
  const r = buildReceipt({ command: "check --diff", summary: "s", findings });
  assert.equal(r.verdict, "fail");
  assert.equal(r.proof, "weak");
  assert.equal(r.risk, "high");
  assert.equal(r.permission, "blocked");
  assert.equal(r.closeout, "blocked");
  assert.equal(exitCode(r.verdict), 2);
});

test("findings are sorted by severity, high first", () => {
  const findings: Finding[] = [
    { id: "wf.no_receipt_policy", severity: "low", impact: "hold", message: "low" },
    { id: "diff.secret_added", severity: "high", impact: "fail", message: "high" },
    { id: "diff.config_touched", severity: "medium", impact: "hold", message: "medium" },
  ];
  const r = buildReceipt({ command: "x", summary: "s", findings });
  assert.deepEqual(
    r.findings.map((f) => f.severity),
    ["high", "medium", "low"],
  );
});

test("writeReceiptFiles writes latest.md and latest.json", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ace-receipts-"));
  const r = buildReceipt({ command: "demo", summary: "s", findings: [] });
  writeReceiptFiles(r, tmp);

  const md = fs.readFileSync(path.join(tmp, ".ace", "receipts", "latest.md"), "utf8");
  const json = JSON.parse(
    fs.readFileSync(path.join(tmp, ".ace", "receipts", "latest.json"), "utf8"),
  ) as Record<string, unknown>;

  assert.ok(md.includes("ACE Receipt: PASS"));
  assert.ok(md.includes("No receipt, no passage."));
  assert.equal(json.schema, "ace.receipt.v0");
  assert.equal(json.saved_to, ".ace/receipts/latest.json");
});
