import { GUIDANCE } from "./rules.js";
import { aggregate } from "./risk.js";
import type { Finding, Receipt } from "../types/receipt.js";

export const VERSION = "0.1.0";

const SEV_RANK: Record<Finding["severity"], number> = { high: 0, medium: 1, low: 2 };

export function buildReceipt(input: {
  command: string;
  summary: string;
  findings: Finding[];
}): Receipt {
  const findings = [...input.findings].sort(
    (a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity],
  );
  const a = aggregate(findings);
  const gaps = findings.filter((f) => f.impact !== "info");
  const missing = dedupe(
    gaps.map((f) => GUIDANCE[f.id]?.missing ?? "").filter((s) => s.length > 0),
  );
  const next = dedupe(
    gaps.map((f) => GUIDANCE[f.id]?.next ?? "").filter((s) => s.length > 0),
  );

  return {
    schema: "ace.receipt.v0",
    tool: "ace-receipts",
    version: VERSION,
    command: input.command,
    verdict: a.verdict,
    gate: a.gate,
    proof: a.proof,
    risk: a.risk,
    permission: a.permission,
    summary: input.summary,
    findings,
    missing_receipts: missing,
    next,
    closeout: a.closeout,
    saved_to: ".ace/receipts/latest.json",
  };
}

function dedupe(items: string[]): string[] {
  return [...new Set(items)];
}
