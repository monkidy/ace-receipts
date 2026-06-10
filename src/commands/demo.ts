import { emit } from "../core/output.js";
import { PHRASES, SLOGAN } from "../core/phrases.js";
import { VERSION, buildReceipt } from "../core/receipt.js";
import type { Finding } from "../types/receipt.js";

/**
 * Demo: a simulated AI agent PR meets the Gate Wizard.
 * Deterministic, offline, exits 1 because the demo receipt is a HOLD.
 * Fail closed is the point.
 */
export function runDemo(): number {
  console.log(
    [
      `ACE RECEIPTS v${VERSION}`,
      SLOGAN,
      "",
      "Demo: an AI agent opened a PR with a new workflow. The Gate Wizard inspects it.",
      "",
      `  PASS  ${PHRASES.pass}`,
      `  HOLD  ${PHRASES.hold}`,
      `  FAIL  ${PHRASES.fail}`,
      "",
    ].join("\n"),
  );

  const file = "demo/.github/workflows/agent-review.yml";
  const findings: Finding[] = [
    {
      id: "wf.no_permissions_block",
      severity: "medium",
      impact: "hold",
      file,
      message: "No explicit permissions block in an AI workflow. Default token permissions apply.",
    },
    {
      id: "wf.unpinned_actions",
      severity: "medium",
      impact: "hold",
      file,
      line: 14,
      message: "1 action reference(s) not pinned to a full commit SHA (first: actions/checkout@v4).",
      evidence: "actions/checkout@v4",
    },
    {
      id: "wf.no_receipt_policy",
      severity: "low",
      impact: "hold",
      file,
      message: "AI workflow detected but no receipt policy found (.ace/policy.yml or an ace-receipts gate).",
    },
  ];

  const receipt = buildReceipt({
    command: "demo",
    summary:
      "Demo scan of a simulated AI agent workflow. The gate holds until receipts arrive. Run scan-workflows on a real repo next.",
    findings,
  });
  return emit(receipt);
}
