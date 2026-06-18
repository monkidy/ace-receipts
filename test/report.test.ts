import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildReport, renderReportMarkdown, writeReportFiles } from "../src/core/report.js";

const NOW = "2026-06-16T00:00:00.000Z";

function repoWith(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ace-report-"));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, "utf8");
  }
  return root;
}

const SAFE_WF = `name: ci
on: [push]
permissions:
  contents: read
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hello
`;

const RISKY_AI_WF = `name: ai-triage
on: pull_request_target
jobs:
  triage:
    runs-on: ubuntu-latest
    steps:
      - run: echo "\${{ github.event.pull_request.title }}" | claude
`;

test("report: empty repo has a pass posture and nothing to gate", () => {
  const root = repoWith({});
  const r = buildReport(root, { now: NOW });
  assert.equal(r.schema, "ace.report.v0");
  assert.equal(r.scope.workflow_files, 0);
  assert.equal(r.posture.verdict, "pass");
  assert.match(r.statement, /no workflows to gate/);
});

test("report: a risky AI workflow fails the posture and is counted", () => {
  const root = repoWith({
    ".github/workflows/safe.yml": SAFE_WF,
    ".github/workflows/ai.yml": RISKY_AI_WF,
  });
  const r = buildReport(root, { now: NOW });

  assert.equal(r.scope.workflow_files, 2);
  assert.equal(r.scope.ai_workflows, 1);
  assert.equal(r.posture.verdict, "fail");
  assert.equal(r.posture.permission, "blocked");
  assert.ok(r.totals.high >= 1);

  // Riskiest workflow is sorted first.
  assert.equal(r.workflows[0].file, ".github/workflows/ai.yml");
  assert.equal(r.workflows[0].isAI, true);
  assert.equal(r.workflows[0].verdict, "fail");
});

test("report: generated_at is injectable for determinism", () => {
  const root = repoWith({ ".github/workflows/safe.yml": SAFE_WF });
  const r = buildReport(root, { now: NOW });
  assert.equal(r.generated_at, NOW);
});

test("report markdown: contains posture, statement and catchphrase", () => {
  const root = repoWith({ ".github/workflows/ai.yml": RISKY_AI_WF });
  const md = renderReportMarkdown(buildReport(root, { now: NOW }));
  assert.ok(md.includes("# ACE Agent Workflow Governance Report"));
  assert.ok(md.includes("AI agent workflow governance: FAIL"));
  assert.ok(md.includes("## Workflow inventory"));
  assert.ok(md.includes("No receipt, no passage."));
});

test("writeReportFiles writes governance-report.md and .json", () => {
  const root = repoWith({ ".github/workflows/ai.yml": RISKY_AI_WF });
  const report = buildReport(root, { now: NOW });
  const { md, json } = writeReportFiles(report, root);

  assert.ok(fs.existsSync(md));
  const parsed = JSON.parse(fs.readFileSync(json, "utf8")) as Record<string, unknown>;
  assert.equal(parsed.schema, "ace.report.v0");
  assert.equal((parsed.scope as { ai_workflows: number }).ai_workflows, 1);
});
