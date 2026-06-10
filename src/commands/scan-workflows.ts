import { emit } from "../core/output.js";
import { buildReceipt } from "../core/receipt.js";
import { scanWorkflows } from "../scanners/workflow-scanner.js";

export function runScanWorkflows(dir: string): number {
  const { findings, summary } = scanWorkflows(dir);
  const command = dir === "." ? "scan-workflows" : `scan-workflows --dir ${dir}`;
  return emit(buildReceipt({ command, summary, findings }));
}
