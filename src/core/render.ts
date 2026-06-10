import { gateWizard } from "./ascii.js";
import { CATCHPHRASE, PHRASES } from "./phrases.js";
import type { Receipt } from "../types/receipt.js";

const COLOR: Record<Receipt["verdict"], string> = {
  pass: "32",
  hold: "33",
  fail: "31",
};

function colorEnabled(): boolean {
  return process.stdout.isTTY === true && !("NO_COLOR" in process.env);
}

function paint(code: string, s: string): string {
  return colorEnabled() ? `\u001b[${code}m${s}\u001b[0m` : s;
}

export function renderTerminal(r: Receipt): string {
  const c = COLOR[r.verdict];
  const out: string[] = [];

  out.push(paint("1", paint(c, `ACE RECEIPT: ${r.verdict.toUpperCase()}`)));
  out.push("");
  out.push(...gateWizard(r.verdict));
  out.push("");
  out.push(paint(c, PHRASES[r.verdict]));
  out.push("");
  out.push(`Gate:       ${r.gate.toUpperCase()}`);
  out.push(`Proof:      ${r.proof}`);
  out.push(`Risk:       ${r.risk}`);
  out.push(`Permission: ${r.permission}`);
  out.push("");
  out.push(`Summary: ${r.summary}`);

  if (r.findings.length > 0) {
    out.push("");
    out.push("Findings:");
    for (const f of r.findings) {
      const loc = f.file ? `${f.file}${f.line ? `:${f.line}` : ""}  ` : "";
      out.push(`  [${f.severity.toUpperCase()}] ${loc}${f.message}`);
    }
  }
  if (r.missing_receipts.length > 0) {
    out.push("");
    out.push("Missing receipts:");
    for (const m of r.missing_receipts) out.push(`  - ${m}`);
  }
  if (r.next.length > 0) {
    out.push("");
    out.push("Next:");
    for (const n of r.next) out.push(`  - ${n}`);
  }

  out.push("");
  out.push(`Closeout: ${r.closeout}`);
  out.push("");
  out.push(paint("1", CATCHPHRASE));
  out.push(paint("2", `Saved: .ace/receipts/latest.md and ${r.saved_to}`));
  return out.join("\n");
}

export function renderMarkdown(r: Receipt): string {
  const out: string[] = [];

  out.push(`# ACE Receipt: ${r.verdict.toUpperCase()}`);
  out.push("");
  out.push("```text");
  out.push(...gateWizard(r.verdict, true));
  out.push("```");
  out.push("");
  out.push(`> ${PHRASES[r.verdict]}`);
  out.push("");
  out.push("| Field | Value |");
  out.push("| --- | --- |");
  out.push(`| Verdict | ${r.verdict} |`);
  out.push(`| Gate | ${r.gate} |`);
  out.push(`| Proof | ${r.proof} |`);
  out.push(`| Risk | ${r.risk} |`);
  out.push(`| Permission | ${r.permission} |`);
  out.push(`| Closeout | ${r.closeout} |`);
  out.push("");
  out.push(`Command: \`ace-receipts ${r.command}\``);
  out.push("");
  out.push(`Summary: ${r.summary}`);

  if (r.findings.length > 0) {
    out.push("");
    out.push("## Findings");
    out.push("");
    for (const f of r.findings) {
      const loc = f.file ? ` \`${f.file}${f.line ? `:${f.line}` : ""}\`` : "";
      out.push(`- **${f.severity.toUpperCase()}**${loc} ${f.message}`);
    }
  }
  if (r.missing_receipts.length > 0) {
    out.push("");
    out.push("## Missing receipts");
    out.push("");
    for (const m of r.missing_receipts) out.push(`- ${m}`);
  }
  if (r.next.length > 0) {
    out.push("");
    out.push("## Next");
    out.push("");
    for (const n of r.next) out.push(`- ${n}`);
  }

  out.push("");
  out.push(`**${CATCHPHRASE}**`);
  return out.join("\n");
}
