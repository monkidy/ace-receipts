import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { aggregate } from "../src/core/risk.js";
import { parseDiff, scanDiff } from "../src/scanners/diff-scanner.js";

const read = (p: string): string => fs.readFileSync(path.resolve(p), "utf8");

test("risky AI PR diff fails the gate", () => {
  const text = read("examples/risky-ai-pr.diff");
  const { findings } = scanDiff(text);
  const ids = findings.map((f) => f.id);

  assert.ok(ids.includes("diff.workflows_touched"));
  assert.ok(ids.includes("diff.sensitive_without_tests"));
  assert.ok(ids.includes("diff.lockfile_changed"));
  assert.ok(ids.includes("diff.secret_added"));

  const a = aggregate(findings);
  assert.equal(a.verdict, "fail");
  assert.equal(a.risk, "high");
});

test("docs only diff passes", () => {
  const text = [
    "diff --git a/README.md b/README.md",
    "index 1111111..2222222 100644",
    "--- a/README.md",
    "+++ b/README.md",
    "@@ -1,2 +1,3 @@",
    " # Title",
    "+One more docs line.",
    "",
  ].join("\n");
  const { findings } = scanDiff(text);
  const a = aggregate(findings);
  assert.equal(a.verdict, "pass");
  assert.ok(findings.some((f) => f.id === "diff.docs_only"));
});

test("source change without tests holds", () => {
  const text = [
    "diff --git a/src/app.ts b/src/app.ts",
    "index 1111111..2222222 100644",
    "--- a/src/app.ts",
    "+++ b/src/app.ts",
    "@@ -1,2 +1,3 @@",
    " export const x = 1;",
    "+export const y = 2;",
    "",
  ].join("\n");
  const { findings } = scanDiff(text);
  const a = aggregate(findings);
  assert.equal(a.verdict, "hold");
  assert.ok(findings.some((f) => f.id === "diff.src_without_tests"));
});

test("parseDiff tracks files, added lines, and line numbers", () => {
  const text = read("examples/risky-ai-pr.diff");
  const files = parseDiff(text);
  assert.equal(files.length, 3);
  assert.equal(files[0].path, ".github/workflows/agent-deploy.yml");
  assert.equal(files[0].isNew, true);
  const charge = files.find((f) => f.path === "src/payments/charge.ts");
  assert.ok(charge);
  const secretLine = charge.added.find((a) => a.text.includes("sk-demo"));
  assert.ok(secretLine);
  assert.equal(secretLine.n, 12);
});

test("empty diff passes with empty summary gate", () => {
  const { findings, summary } = scanDiff("");
  assert.deepEqual(findings, []);
  assert.ok(summary.includes("Empty diff"));
});
