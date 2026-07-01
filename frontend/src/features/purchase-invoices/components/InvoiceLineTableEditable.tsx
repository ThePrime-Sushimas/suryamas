import { AlertCircle } from "lucide-react";
import { fmtCurrency } from "../utils/purchaseInvoice.formatters";
import type { PILine } from "../types/purchaseInvoice.types";

interface InvoiceLineTableEditableProps {
  lines: PILine[];
  onLineChange: (index: number, updates: Partial<PILine>) => void;
}

export function InvoiceLineTableEditable({
  lines,
  onLineChange,
}: InvoiceLineTableEditableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50/50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400">
          <tr>
            <th className="px-4 py-2 text-left font-semibold text-[10px] uppercase">Produk</th>
            <th className="px-4 py-2 text-center font-semibold text-[10px] uppercase">Qty GR</th>
            <th className="px-4 py-2 text-center font-semibold text-[10px] uppercase">Qty Invoice</th>
            <th className="px-4 py-2 text-right font-semibold text-[10px] uppercase">Harga Satuan</th>
            <th className="px-4 py-2 text-center font-semibold text-[10px] uppercase">PPN %</th>
            <th className="px-4 py-2 text-right font-semibold text-[10px] uppercase">Total</th>
            <th className="px-4 py-2 text-center font-semibold text-[10px] uppercase">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
          {lines.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-12 text-center text-gray-400 italic">
                Belum ada barang. Pilih GR di atas untuk memulai.
              </td>
            </tr>
          ) : (
            lines.map((l, index) => {
              const lineSubtotal = l.qty_invoiced * l.unit_price;
              const lineTotal = lineSubtotal * (1 + l.tax_rate / 100);
              const uomInvoice = l.uom_invoice || l.uom_received;
              const qtyReceivedInv = l.qty_received_invoice_uom;
              const isOver = l.qty_invoiced > qtyReceivedInv;
              const isUnder = l.qty_invoiced < qtyReceivedInv;

              return (
                <tr key={index} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">{l.product_name}</div>
                    <div className="text-[10px] text-gray-500 font-mono">{l.product_code} · {l.gr_number}</div>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400 font-medium">
                    {qtyReceivedInv}
                    {uomInvoice ? <span className="text-[10px] text-gray-400 block">{uomInvoice}</span> : null}
                    {l.uom_received && uomInvoice && l.uom_received !== uomInvoice ? (
                      <span className="text-[10px] text-gray-400 block">({l.qty_received} {l.uom_received} di GR)</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="number"
                      value={l.qty_invoiced}
                      onChange={(e) => onLineChange(index, { qty_invoiced: Number(e.target.value) })}
                      className={`w-20 px-2 py-1 border rounded text-center text-sm outline-none focus:ring-2 ${
                        isOver
                          ? "border-red-300 focus:ring-red-500 text-red-600"
                          : "border-gray-200 dark:border-gray-600 focus:ring-indigo-500"
                      }`}
                    />
                    {uomInvoice ? <span className="text-[10px] text-gray-400 block">{uomInvoice}</span> : null}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      value={l.unit_price}
                      onChange={(e) => onLineChange(index, { unit_price: Number(e.target.value) })}
                      className="w-28 px-2 py-1 border border-gray-200 dark:border-gray-600 rounded text-right text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      PO: {fmtCurrency(l.unit_price_po)}{uomInvoice ? `/${uomInvoice}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="number"
                      value={l.tax_rate}
                      onChange={(e) => onLineChange(index, { tax_rate: Number(e.target.value) })}
                      className="w-16 px-2 py-1 border border-gray-200 dark:border-gray-600 rounded text-center text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
                    {fmtCurrency(lineTotal)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isOver ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold">
                        <AlertCircle className="w-3 h-3" /> OVER
                      </span>
                    ) : isUnder ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 text-[10px] font-bold">
                        UNDER
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-bold">
                        MATCH
                      </span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
