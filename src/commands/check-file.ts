import fs from "node:fs";
import { emit } from "../core/output.js";
import { buildReceipt } from "../core/receipt.js";
import { scanFile } from "../scanners/file-scanner.js";

export function runCheckFile(p: string): number {
  if (!fs.existsSync(p)) {
    const receipt = buildReceipt({
      command: `check --file ${p}`,
      summary: `File not found: ${p}. Fail closed.`,
      findings: [
        {
          id: "file.not_found",
          severity: "high",
          impact: "fail",
          file: p,
          message: "The file to check does not exist.",
        },
      ],
    });
    return emit(receipt);
  }

  const content = fs.readFileSync(p, "utf8");
  const { findings, summary } = scanFile(p, content);
  return emit(buildReceipt({ command: `check --file ${p}`, summary, findings }));
}
