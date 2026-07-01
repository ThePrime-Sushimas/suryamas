import type { PIChargeRow } from "../types/purchaseInvoice.types";

export function computeChargeLine(amount: number, taxRate: number) {
  const tax = amount * (taxRate / 100);
  return { tax_amount: tax, total: amount + tax };
}

/** Allow typing "-" and partial decimals; comma → dot. */
export function sanitizeChargeAmountInput(raw: string): string {
  let s = raw.replace(/\s/g, "").replace(/,/g, ".");
  if (s === "") return "";
  let out = "";
  let hasDot = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (i === 0 && ch === "-") {
      out += "-";
      continue;
    }
    if (ch >= "0" && ch <= "9") {
      out += ch;
      continue;
    }
    if (ch === "." && !hasDot) {
      hasDot = true;
      out += ".";
    }
  }
  return out;
}

export function parseChargeAmountInput(s: string): number {
  const t = s.trim().replace(/,/g, ".");
  if (t === "" || t === "-" || t === "." || t === "-.") return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

/** Align with backend: diskon affects_dpp tidak punya PPN di baris charge. */
export function effectiveChargeTaxRate(c: PIChargeRow): number {
  if (c.charge_type === "DISCOUNT" && c.affects_dpp) return 0;
  return c.tax_rate;
}
