import { SECRET_PATTERNS, classifyPath } from "../core/rules.js";
import { scanDiff } from "./diff-scanner.js";
import { repoHasReceiptPolicy, scanWorkflowContent } from "./workflow-scanner.js";
import type { Finding } from "../types/receipt.js";

/**
 * Route a single file to the right scanner:
 * workflow yaml goes to the workflow scanner, diff or patch content goes to
 * the diff scanner, everything else gets a generic secret and path check.
 */
export function scanFile(p: string, content: string): { findings: Finding[]; summary: string } {
  const norm = p.replace(/\\/g, "/");
  const looksYaml = /\.ya?ml$/i.test(norm);
  const looksWorkflow =
    norm.includes(".github/workflows/") ||
    (looksYaml && /^\s*on\s*:/m.test(content) && /^\s*jobs\s*:/m.test(content));
  const looksDiff =
    /\.(diff|patch)$/i.test(norm) ||
    content.startsWith("diff --git") ||
    /^\+\+\+ /m.test(content);

  if (looksWorkflow) {
    const res = scanWorkflowContent(norm, content, repoHasReceiptPolicy(process.cwd()));
    const summary = `Workflow ${norm}: ${res.isAI ? "AI markers detected" : "no AI markers"}. Findings: ${res.findings.length}.`;
    return { findings: res.findings, summary };
  }

  if (looksDiff) {
    const res = scanDiff(content);
    return { findings: res.findings, summary: `Diff file ${norm}. ${res.summary}` };
  }

  const findings: Finding[] = [];
  content.split(/\r?\n/).forEach((text, i) => {
    for (const sp of SECRET_PATTERNS) {
      if (sp.re.test(text)) {
        findings.push({
          id: "file.secret_in_file",
          severity: "high",
          impact: "fail",
          file: norm,
          line: i + 1,
          message: `Secret looking string found (${sp.name}). Value not shown.`,
        });
        break;
      }
    }
  });

  const cls = classifyPath(norm);
  if (cls === "auth" || cls === "security" || cls === "payments" || cls === "billing" || cls === "env") {
    findings.push({
      id: "file.sensitive_path",
      severity: "medium",
      impact: "hold",
      file: norm,
      message: `Sensitive path (${cls}). Changes here need review receipts.`,
    });
  }

  return { findings, summary: `File ${norm}. Findings: ${findings.length}.` };
}
