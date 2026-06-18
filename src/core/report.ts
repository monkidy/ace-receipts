import fs from "node:fs";
import path from "node:path";
import { CATCHPHRASE } from "./phrases.js";
import { buildReceipt, VERSION } from "./receipt.js";
import { aggregate } from "./risk.js";
import {
  listWorkflowFiles,
  repoHasReceiptPolicy,
  scanWorkflowContent,
} from "../scanners/workflow-scanner.js";
import type { Finding, Severity, Verdict } from "../types/receipt.js";
import type { GovernanceReport, WorkflowPosture } from "../types/report.js";

const VERDICT_RANK: Record<Verdict, number> = { fail: 0, hold: 1, pass: 2 };

function count(findings: Finding[], severity: Severity): number {
  return findings.filter((f) => f.severity === severity).length;
}

/**
 * Scan every workflow in a repository and build a repo-level governance
 * report. The overall posture reuses the same fail-closed aggregation as a
 * single receipt, so the report never disagrees with `scan-workflows`.
 */
export function buildReport(dir: string, opts: { now?: string } = {}): GovernanceReport {
  const files = listWorkflowFiles(dir);
  const hasPolicy = repoHasReceiptPolicy(dir);

  const allFindings: Finding[] = [];
  const workflows: WorkflowPosture[] = [];
  let aiCount = 0;

  for (const rel of files) {
    const content = fs.readFileSync(path.join(dir, rel), "utf8");
    const res = scanWorkflowContent(rel, content, hasPolicy);
    if (res.isAI) aiCount += 1;
    allFindings.push(...res.findings);
    const a = aggregate(res.findings);
    workflows.push({
      file: rel,
      isAI: res.isAI,
      verdict: a.verdict,
      risk: a.risk,
      findings: res.findings.length,
      high: count(res.findings, "high"),
      medium: count(res.findings, "medium"),
      low: count(res.findings, "low"),
    });
  }

  workflows.sort(
    (a, b) => VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict] || a.file.localeCompare(b.file),
  );

  const summary =
    files.length === 0
      ? "No workflow files found under .github/workflows. Nothing to gate."
      : `Scanned ${files.length} workflow file(s). AI workflows detected: ${aiCount}. Findings: ${allFindings.length}.`;

  // The overall posture, missing receipts and next actions come from the same
  // builder a single receipt uses. One source of truth for the gate logic.
  const receipt = buildReceipt({ command: "report", summary, findings: allFindings });

  const totals = {
    findings: allFindings.length,
    high: count(allFindings, "high"),
    medium: count(allFindings, "medium"),
    low: count(allFindings, "low"),
    fail: allFindings.filter((f) => f.impact === "fail").length,
    hold: allFindings.filter((f) => f.impact === "hold").length,
    info: allFindings.filter((f) => f.impact === "info").length,
  };

  const statement =
    files.length === 0
      ? "AI agent workflow governance: no workflows to gate."
      : `AI agent workflow governance: ${receipt.verdict.toUpperCase()}. ${aiCount} of ${files.length} workflow(s) use AI. ${totals.high} high-risk finding(s).`;

  return {
    schema: "ace.report.v0",
    tool: "ace-receipts",
    version: VERSION,
    generated_at: opts.now ?? new Date().toISOString(),
    scope: { dir, workflow_files: files.length, ai_workflows: aiCount },
    posture: {
      verdict: receipt.verdict,
      gate: receipt.gate,
      proof: receipt.proof,
      risk: receipt.risk,
      permission: receipt.permission,
      closeout: receipt.closeout,
    },
    totals,
    workflows,
    findings: receipt.findings,
    missing_receipts: receipt.missing_receipts,
    next: receipt.next,
    statement,
  };
}

/** Render the governance report as shareable Markdown. */
export function renderReportMarkdown(r: GovernanceReport): string {
  const out: string[] = [];

  out.push("# ACE Agent Workflow Governance Report");
  out.push("");
  out.push(`> ${r.statement}`);
  out.push("");
  out.push(`Generated: ${r.generated_at}`);
  out.push(`Tool: \`${r.tool}\` v${r.version} (schema \`${r.schema}\`)`);
  out.push(
    `Scope: \`${r.scope.dir}\` | workflow files: ${r.scope.workflow_files} | AI workflows: ${r.scope.ai_workflows}`,
  );
  out.push("");

  out.push("## Posture");
  out.push("");
  out.push("| Field | Value |");
  out.push("| --- | --- |");
  out.push(`| Verdict | ${r.posture.verdict} |`);
  out.push(`| Gate | ${r.posture.gate} |`);
  out.push(`| Proof | ${r.posture.proof} |`);
  out.push(`| Risk | ${r.posture.risk} |`);
  out.push(`| Permission | ${r.posture.permission} |`);
  out.push(`| Closeout | ${r.posture.closeout} |`);
  out.push("");

  out.push("## Totals");
  out.push("");
  out.push("| Metric | Count |");
  out.push("| --- | --- |");
  out.push(`| Findings | ${r.totals.findings} |`);
  out.push(`| High severity | ${r.totals.high} |`);
  out.push(`| Medium severity | ${r.totals.medium} |`);
  out.push(`| Low severity | ${r.totals.low} |`);
  out.push(`| Gate-failing | ${r.totals.fail} |`);
  out.push(`| Gate-holding | ${r.totals.hold} |`);
  out.push("");

  if (r.workflows.length > 0) {
    out.push("## Workflow inventory");
    out.push("");
    out.push("| Workflow | AI | Verdict | Risk | High | Medium | Low |");
    out.push("| --- | --- | --- | --- | --- | --- | --- |");
    for (const w of r.workflows) {
      out.push(
        `| \`${w.file}\` | ${w.isAI ? "yes" : "no"} | ${w.verdict} | ${w.risk} | ${w.high} | ${w.medium} | ${w.low} |`,
      );
    }
    out.push("");
  }

  if (r.findings.length > 0) {
    out.push("## Findings");
    out.push("");
    for (const f of r.findings) {
      const loc = f.file ? ` \`${f.file}${f.line ? `:${f.line}` : ""}\`` : "";
      out.push(`- **${f.severity.toUpperCase()}**${loc} ${f.message}`);
    }
    out.push("");
  }

  if (r.missing_receipts.length > 0) {
    out.push("## Missing receipts");
    out.push("");
    for (const m of r.missing_receipts) out.push(`- ${m}`);
    out.push("");
  }

  if (r.next.length > 0) {
    out.push("## Next actions");
    out.push("");
    for (const n of r.next) out.push(`- ${n}`);
    out.push("");
  }

  out.push(`**${CATCHPHRASE}**`);
  return out.join("\n");
}

/** Write the governance report to .ace/reports/ as Markdown and JSON. */
export function writeReportFiles(report: GovernanceReport, cwd: string = process.cwd()): {
  md: string;
  json: string;
} {
  const dir = path.join(cwd, ".ace", "reports");
  fs.mkdirSync(dir, { recursive: true });
  const mdPath = path.join(dir, "governance-report.md");
  const jsonPath = path.join(dir, "governance-report.json");
  fs.writeFileSync(mdPath, renderReportMarkdown(report) + "\n", "utf8");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  return { md: mdPath, json: jsonPath };
}
