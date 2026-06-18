import type {
  Closeout,
  Finding,
  Gate,
  Permission,
  Proof,
  Risk,
  Verdict,
} from "./receipt.js";

/** Per-workflow posture line in the governance report. */
export interface WorkflowPosture {
  file: string;
  isAI: boolean;
  verdict: Verdict;
  risk: Risk;
  findings: number;
  high: number;
  medium: number;
  low: number;
}

/** Repo-level posture, aggregated from every finding in scope. */
export interface ReportPosture {
  verdict: Verdict;
  gate: Gate;
  proof: Proof;
  risk: Risk;
  permission: Permission;
  closeout: Closeout;
}

export interface ReportTotals {
  findings: number;
  high: number;
  medium: number;
  low: number;
  fail: number;
  hold: number;
  info: number;
}

/**
 * A shareable, repo-level governance report over AI agent workflows.
 * One receipt answers "can this change merge". One report answers
 * "what is the governance posture of this repository", for a reviewer,
 * a security lead, or a client.
 */
export interface GovernanceReport {
  schema: "ace.report.v0";
  tool: "ace-receipts";
  version: string;
  generated_at: string;
  scope: { dir: string; workflow_files: number; ai_workflows: number };
  posture: ReportPosture;
  totals: ReportTotals;
  workflows: WorkflowPosture[];
  findings: Finding[];
  missing_receipts: string[];
  next: string[];
  statement: string;
}
