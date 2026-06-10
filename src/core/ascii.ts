import type { Verdict } from "../types/receipt.js";

/**
 * Gate Wizard ASCII V0. Frozen. People will screenshot this.
 * Keep it compact, keep the staff, keep the gate line, keep the layout vertical.
 */
const WIZARD_UNICODE = [
  "          ✦",
  "      /_\\ │",
  "     (•_•)│",
  "      /|_ │",
  "      / \\ │",
  "   ════╪════",
  "         │",
];

/** Plain ASCII fallback for terminals without unicode (set ACE_RECEIPTS_ASCII=1). */
const WIZARD_PLAIN = [
  "          *",
  "      /_\\ |",
  "     (o_o)|",
  "      /|_ |",
  "      / \\ |",
  "   ====+====",
  "         |",
];

export function gateWizard(_verdict: Verdict, forceUnicode = false): string[] {
  const plain = !forceUnicode && process.env.ACE_RECEIPTS_ASCII === "1";
  return plain ? [...WIZARD_PLAIN] : [...WIZARD_UNICODE];
}
