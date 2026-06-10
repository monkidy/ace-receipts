import type { Verdict } from "../types/receipt.js";

export const SLOGAN = "AI agents can cook. Make them bring receipts.";
export const CATCHPHRASE = "No receipt, no passage.";

/** One memorable line per verdict. Exactly one. */
export const PHRASES: Record<Verdict, string> = {
  pass: "Proof opens the gate.",
  hold: "Not yet. Bring receipts.",
  fail: "Vibes shall not pass.",
};
