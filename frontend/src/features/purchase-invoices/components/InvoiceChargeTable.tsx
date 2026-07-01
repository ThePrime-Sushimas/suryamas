import { fmtCurrency } from "@/lib/formatters";
import { PI_CHARGE_LABELS } from "../types/purchaseInvoice.status";
import type { PurchaseInvoiceCharge } from "../api/purchaseInvoices.api";

interface InvoiceChargeTableProps {
  charges: PurchaseInvoiceCharge[];
}

export function InvoiceChargeTable({ charges }: InvoiceChargeTableProps) {
  if (charges.length === 0) return null;

  return (
    <div className="border-t border-gray-100 dark:border-gray-700 px-6 py-4">
      <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
        Diskon &amp; biaya lain
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-gray-500 dark:text-gray-400 text-[10px] uppercase">
            <tr>
              <th className="text-left py-2 pr-4">Jenis</th>
              <th className="text-left py-2 pr-4">Keterangan</th>
              <th className="text-right py-2">Nilai (pra-PPN)</th>
              <th className="text-center py-2 px-2">PPN %</th>
              <th className="text-center py-2 px-2">DPP</th>
              <th className="text-right py-2">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {charges.map((c) => (
              <tr key={c.id}>
                <td className="py-2 pr-4 text-gray-900 dark:text-white">
                  {PI_CHARGE_LABELS[c.charge_type] ?? c.charge_type}
                </td>
                <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">{c.description ?? "—"}</td>
                <td className="py-2 text-right font-medium">{fmtCurrency(Number(c.amount))}</td>
                <td className="py-2 text-center text-gray-600 dark:text-gray-400">{Number(c.tax_rate)}%</td>
                <td className="py-2 text-center text-gray-600 dark:text-gray-400 text-xs">
                  {c.affects_dpp ? "Ya" : "—"}
                </td>
                <td className="py-2 text-right font-bold text-gray-900 dark:text-white">
                  {fmtCurrency(Number(c.total))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
