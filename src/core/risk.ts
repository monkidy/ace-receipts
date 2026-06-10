import type {
  Closeout,
  Finding,
  Gate,
  Permission,
  Proof,
  Risk,
  Verdict,
} from "../types/receipt.js";

export interface Aggregate {
  verdict: Verdict;
  gate: Gate;
  proof: Proof;
  risk: Risk;
  permission: Permission;
  closeout: Closeout;
}

/**
 * The gate is closed by default. Any fail-impact finding fails the gate.
 * Any hold-impact finding holds it. Info findings let it pass.
 */
export function aggregate(findings: Finding[]): Aggregate {
  const verdict: Verdict = findings.some((f) => f.impact === "fail")
    ? "fail"
    : findings.some((f) => f.impact === "hold")
      ? "hold"
      : "pass";

  const risk: Risk = findings.some((f) => f.severity === "high")
    ? "high"
    : findings.some((f) => f.severity === "medium")
      ? "medium"
      : "low";

  const gate: Gate = verdict === "pass" ? "pass" : "fail";
  const proof: Proof = verdict === "pass" ? "sufficient" : verdict === "hold" ? "partial" : "weak";
  const permission: Permission =
    verdict === "pass" ? "merge_allowed" : verdict === "hold" ? "human_review_required" : "blocked";
  const closeout: Closeout = verdict === "pass" ? "ready" : verdict === "hold" ? "pending" : "blocked";

  return { verdict, gate, proof, risk, permission, closeout };
}

/** 0 = PASS, 1 = HOLD, 2 = FAIL. */
export function exitCode(verdict: Verdict): number {
  return verdict === "pass" ? 0 : verdict === "hold" ? 1 : 2;
}
