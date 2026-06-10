import fs from "node:fs";
import path from "node:path";
import { globSync } from "glob";
import {
  AI_MARKERS,
  COMMENT_WRITE_RES,
  CRITICAL_WRITE_RES,
  GENERIC_EVENT_RE,
  GITHUB_TOKEN_RE,
  PROVIDER_KEY_MARKERS,
  SECRETS_USE_RE,
  UNTRUSTED_MARKERS,
  matchMarker,
} from "../core/rules.js";
import type { Finding, Impact, Severity } from "../types/receipt.js";

export interface WorkflowScanResult {
  file: string;
  isAI: boolean;
  findings: Finding[];
}

interface Hit {
  line: number;
  text: string;
}

export function scanWorkflowContent(
  file: string,
  content: string,
  repoHasPolicy: boolean,
): WorkflowScanResult {
  const lines = content.split(/\r?\n/);
  const findings: Finding[] = [];

  const aiHits: Hit[] = [];
  const untrustedHits: Hit[] = [];
  const genericEventHits: Hit[] = [];
  const unpinnedUses: Hit[] = [];
  const providerKeyHits: Hit[] = [];
  let pullRequestTargetLine = 0;
  let criticalWrite: Hit | null = null;
  let commentWrite: Hit | null = null;
  let secretsUse: Hit | null = null;

  lines.forEach((text, i) => {
    const line = i + 1;

    for (const m of AI_MARKERS) {
      if (matchMarker(text, m)) {
        aiHits.push({ line, text: m });
        break;
      }
    }

    let strong = false;
    for (const m of UNTRUSTED_MARKERS) {
      if (matchMarker(text, m)) {
        untrustedHits.push({ line, text: m });
        strong = true;
        break;
      }
    }
    if (!strong && GENERIC_EVENT_RE.test(text)) {
      genericEventHits.push({ line, text: "github.event.*" });
    }

    if (pullRequestTargetLine === 0 && /pull_request_target/.test(text)) {
      pullRequestTargetLine = line;
    }
    if (criticalWrite === null) {
      for (const re of CRITICAL_WRITE_RES) {
        if (re.test(text)) {
          criticalWrite = { line, text: text.trim() };
          break;
        }
      }
    }
    if (commentWrite === null) {
      for (const re of COMMENT_WRITE_RES) {
        if (re.test(text)) {
          commentWrite = { line, text: text.trim() };
          break;
        }
      }
    }
    if (secretsUse === null && SECRETS_USE_RE.test(text)) {
      secretsUse = { line, text: text.trim() };
    }
    for (const k of PROVIDER_KEY_MARKERS) {
      if (text.includes(k)) {
        providerKeyHits.push({ line, text: k });
        break;
      }
    }

    const uses = /^\s*-?\s*uses\s*:\s*([^\s#"']+)/.exec(text);
    if (uses) {
      const ref = uses[1];
      if (!ref.startsWith("./") && !ref.startsWith("docker://")) {
        const at = ref.lastIndexOf("@");
        const sha = at >= 0 ? ref.slice(at + 1) : "";
        if (!/^[0-9a-f]{40}$/.test(sha)) {
          unpinnedUses.push({ line, text: ref });
        }
      }
    }
  });

  const isAI = aiHits.length > 0;
  const hasUntrusted = untrustedHits.length > 0;
  const hasPermissionsBlock = /^\s*permissions\s*:/m.test(content);
  const hasEnvironment = /^\s*environment\s*:/m.test(content);
  const usesGithubToken = GITHUB_TOKEN_RE.test(content);
  const policyFound = repoHasPolicy || /ace-receipts/i.test(content);

  const add = (
    id: string,
    severity: Severity,
    impact: Impact,
    message: string,
    hit?: Hit,
  ): void => {
    findings.push({
      id,
      severity,
      impact,
      file,
      line: hit?.line,
      message,
      evidence: hit?.text,
    });
  };

  if (isAI && pullRequestTargetLine > 0) {
    add(
      "wf.pull_request_target_with_ai",
      "high",
      "fail",
      "pull_request_target used in a workflow with AI markers. Untrusted PR content can reach a privileged context.",
      { line: pullRequestTargetLine, text: "pull_request_target" },
    );
  }
  if (isAI && hasUntrusted) {
    const h = untrustedHits[0];
    add(
      "wf.untrusted_input_with_ai",
      "high",
      "fail",
      `Untrusted event input (${h.text}) flows into an AI workflow. Prompt injection risk.`,
      h,
    );
  }
  if (hasUntrusted && criticalWrite !== null) {
    add(
      "wf.write_access_with_untrusted_input",
      "high",
      "fail",
      "Write permissions granted while the workflow reads untrusted event input.",
      criticalWrite,
    );
  } else if (hasUntrusted && usesGithubToken && !hasPermissionsBlock) {
    add(
      "wf.write_access_with_untrusted_input",
      "high",
      "fail",
      "GITHUB_TOKEN available with untrusted event input and no explicit permissions block. Default token permissions may include write.",
      untrustedHits[0],
    );
  }
  if (isAI && hasUntrusted && secretsUse !== null) {
    add(
      "wf.secrets_with_untrusted_and_ai",
      "high",
      "fail",
      "Secrets are available in a workflow that reads untrusted input and uses AI markers.",
      secretsUse,
    );
  }
  if (isAI && !hasPermissionsBlock) {
    add(
      "wf.no_permissions_block",
      "medium",
      "hold",
      "No explicit permissions block in an AI workflow. Default token permissions apply.",
    );
  }
  if (isAI && unpinnedUses.length > 0) {
    add(
      "wf.unpinned_actions",
      "medium",
      "hold",
      `${unpinnedUses.length} action reference(s) not pinned to a full commit SHA (first: ${unpinnedUses[0].text}).`,
      unpinnedUses[0],
    );
  }
  if (
    commentWrite !== null &&
    (hasUntrusted || genericEventHits.length > 0) &&
    !(hasUntrusted && criticalWrite !== null)
  ) {
    add(
      "wf.comment_with_untrusted_input",
      "medium",
      "hold",
      "Workflow can post PR or issue comments while reading event input.",
      commentWrite,
    );
  }
  if (isAI && providerKeyHits.length > 0) {
    add(
      "wf.provider_key_in_env",
      "medium",
      "hold",
      `AI provider key referenced in workflow (${providerKeyHits[0].text}).`,
      providerKeyHits[0],
    );
  }
  if (isAI && !hasUntrusted && genericEventHits.length > 0) {
    add(
      "wf.generic_event_input",
      "medium",
      "hold",
      "AI workflow reads github.event payload fields. Verify they are not attacker controlled.",
      genericEventHits[0],
    );
  }
  if (isAI && !policyFound) {
    add(
      "wf.no_receipt_policy",
      "low",
      "hold",
      "AI workflow detected but no receipt policy found (.ace/policy.yml or an ace-receipts gate).",
    );
  }
  if (isAI && !hasEnvironment) {
    add(
      "wf.no_human_gate",
      "low",
      "hold",
      "No environment protection rule on an agentic workflow. No manual approval gate detected.",
    );
  }

  return { file, isAI, findings };
}

export function repoHasReceiptPolicy(dir: string): boolean {
  return ["policy.yml", "policy.yaml", "policy.json"].some((f) =>
    fs.existsSync(path.join(dir, ".ace", f)),
  );
}

export function scanWorkflows(dir: string): { findings: Finding[]; summary: string } {
  const patterns = [".github/workflows/**/*.yml", ".github/workflows/**/*.yaml"];
  const files = globSync(patterns, { cwd: dir, nodir: true, dot: true }).sort();

  if (files.length === 0) {
    return {
      findings: [],
      summary: "No workflow files found under .github/workflows. Nothing to gate.",
    };
  }

  const hasPolicy = repoHasReceiptPolicy(dir);
  const findings: Finding[] = [];
  let aiCount = 0;

  for (const rel of files) {
    const normRel = rel.replace(/\\/g, "/");
    const content = fs.readFileSync(path.join(dir, rel), "utf8");
    const res = scanWorkflowContent(normRel, content, hasPolicy);
    if (res.isAI) aiCount += 1;
    findings.push(...res.findings);
  }

  const summary = `Scanned ${files.length} workflow file(s). AI workflows detected: ${aiCount}. Findings: ${findings.length}.`;
  return { findings, summary };
}
