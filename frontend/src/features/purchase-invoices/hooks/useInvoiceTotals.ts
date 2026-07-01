import { useMemo } from "react";
import {
  computeChargeLine,
  parseChargeAmountInput,
  effectiveChargeTaxRate,
} from "../utils/purchaseInvoice.charges";
import type { PILine, PIChargeRow } from "../types/purchaseInvoice.types";

const TAX_RATE_EPS = 0.001;

export interface InvoiceTotals {
  subtotal: number;
  tax: number;
  totalCharges: number;
  total: number;
}

export function useInvoiceTotals(
  lines: PILine[],
  charges: PIChargeRow[],
): InvoiceTotals {
  return useMemo(() => {
    const lineAgg = lines.reduce(
      (acc, l) => {
        const subtotal = l.qty_invoiced * l.unit_price;
        const tax = subtotal * (l.tax_rate / 100);
        return {
          subtotal: acc.subtotal + subtotal,
          lineTax: acc.lineTax + tax,
          lineGrand: acc.lineGrand + subtotal + tax,
        };
      },
      { subtotal: 0, lineTax: 0, lineGrand: 0 },
    );

    const hasAffectsDppDiscount = charges.some(
      (c) => c.charge_type === "DISCOUNT" && c.affects_dpp,
    );
    const dppDiscountSum = charges
      .filter((c) => c.charge_type === "DISCOUNT" && c.affects_dpp)
      .reduce((s, c) => s + parseChargeAmountInput(c.amount), 0);
    const uniformLineTax =
      lines.length > 0 &&
      lines.every(
        (l) =>
          Math.abs(Number(l.tax_rate) - Number(lines[0].tax_rate)) <
          TAX_RATE_EPS,
      );

    let lineTax = lineAgg.lineTax;
    let lineGrand = lineAgg.lineGrand;
    if (hasAffectsDppDiscount && uniformLineTax) {
      const S = lineAgg.subtotal;
      const netDpp = S + dppDiscountSum;
      const r0 = Number(lines[0].tax_rate);
      lineTax = netDpp * (r0 / 100);
      lineGrand = S + lineTax;
    }

    const chargeAgg = charges.reduce(
      (acc, c) => {
        const amt = parseChargeAmountInput(c.amount);
        const rate = effectiveChargeTaxRate(c);
        const { tax_amount, total } = computeChargeLine(amt, rate);
        return {
          chargeTax: acc.chargeTax + tax_amount,
          chargeGrand: acc.chargeGrand + total,
        };
      },
      { chargeTax: 0, chargeGrand: 0 },
    );

    return {
      subtotal: lineAgg.subtotal,
      tax: lineTax + chargeAgg.chargeTax,
      totalCharges: chargeAgg.chargeGrand,
      total: lineGrand + chargeAgg.chargeGrand,
    };
  }, [lines, charges]);
}
