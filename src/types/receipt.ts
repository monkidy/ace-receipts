export type Verdict = "pass" | "hold" | "fail";
export type Gate = "pass" | "fail";
export type Proof = "sufficient" | "partial" | "weak";
export type Risk = "low" | "medium" | "high";
export type Permission = "merge_allowed" | "human_review_required" | "blocked";
export type Closeout = "ready" | "pending" | "blocked";
export type Severity = "low" | "medium" | "high";

/**
 * How a finding moves the gate.
 * fail: the gate fails. hold: the gate holds. info: informational, gate can pass.
 */
export type Impact = "fail" | "hold" | "info";

export interface Finding {
  id: string;
  severity: Severity;
  impact: Impact;
  file?: string;
  line?: number;
  message: string;
  evidence?: string;
}

export interface Receipt {
  schema: "ace.receipt.v0";
  tool: "ace-receipts";
  version: string;
  command: string;
  verdict: Verdict;
  gate: Gate;
  proof: Proof;
  risk: Risk;
  permission: Permission;
  summary: string;
  findings: Finding[];
  missing_receipts: string[];
  next: string[];
  closeout: Closeout;
  saved_to: string;
}
