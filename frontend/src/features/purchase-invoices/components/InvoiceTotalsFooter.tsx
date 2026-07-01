import { fmtCurrency } from "../utils/purchaseInvoice.formatters";
import type { InvoiceTotals } from "../hooks/useInvoiceTotals";

interface InvoiceTotalsFooterProps {
  totals: InvoiceTotals;
  hasCharges: boolean;
  /** Controls label/color style: "form" for edit, "view" for detail */
  variant?: "form" | "view";
}

export function InvoiceTotalsFooter({
  totals,
  hasCharges,
  variant = "view",
}: InvoiceTotalsFooterProps) {
  const isForm = variant === "form";

  return (
    <div className={`px-6 py-${isForm ? "4" : "6"} border-t border-gray-100 dark:border-gray-700 ${isForm ? "bg-gray-50/50 dark:bg-gray-700/30" : "bg-gray-50/30 dark:bg-gray-700/30"}`}>
      <div className="flex flex-col items-end gap-2">
        <div className="flex justify-between w-64 text-sm">
          <span className="text-gray-500">Subtotal barang</span>
          <span className={`font-medium ${isForm ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400"}`}>
            {fmtCurrency(totals.subtotal)}
          </span>
        </div>

        {hasCharges && (
          <div className="flex justify-between w-64 text-sm">
            <span className="text-gray-500">Diskon &amp; biaya (net)</span>
            <span className={`font-medium ${
              totals.totalCharges < 0
                ? "text-green-600 dark:text-green-400"
                : isForm ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400"
            }`}>
              {fmtCurrency(totals.totalCharges)}
            </span>
          </div>
        )}

        <div className="flex justify-between w-64 text-sm">
          <span className="text-gray-500">Total PPN</span>
          <span className={`font-medium ${isForm ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400"}`}>
            {fmtCurrency(totals.tax)}
          </span>
        </div>

        <div className={`flex justify-between w-64 pt-${isForm ? "2" : "3"} mt-1 border-t border-gray-200 dark:border-gray-600 font-bold ${isForm ? "text-lg" : "text-xl"} text-indigo-600 dark:text-indigo-400 tracking-tight`}>
          <span>{isForm ? "Total Akhir" : "TOTAL AKHIR"}</span>
          <span>{fmtCurrency(totals.total)}</span>
        </div>
      </div>
    </div>
  );
}
