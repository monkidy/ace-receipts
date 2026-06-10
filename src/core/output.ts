import fs from "node:fs";
import path from "node:path";
import { renderMarkdown, renderTerminal } from "./render.js";
import { exitCode } from "./risk.js";
import type { Receipt } from "../types/receipt.js";

export function writeReceiptFiles(receipt: Receipt, cwd: string = process.cwd()): void {
  const dir = path.join(cwd, ".ace", "receipts");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "latest.md"), renderMarkdown(receipt) + "\n", "utf8");
  fs.writeFileSync(
    path.join(dir, "latest.json"),
    JSON.stringify(receipt, null, 2) + "\n",
    "utf8",
  );
}

/** Print the terminal receipt, write latest.md and latest.json, return the exit code. */
export function emit(receipt: Receipt): number {
  console.log(renderTerminal(receipt));
  writeReceiptFiles(receipt);
  return exitCode(receipt.verdict);
}
