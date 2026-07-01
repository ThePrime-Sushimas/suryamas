import { fmtCurrency, fmtQty } from "../utils/purchaseInvoice.formatters";
import type { PurchaseInvoiceLine } from "../api/purchaseInvoices.api";

interface InvoiceLineTableProps {
  lines: PurchaseInvoiceLine[];
}

export function InvoiceLineTable({ lines }: InvoiceLineTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50/50 dark:bg-gray-700/50 text-gray-500">
          <tr>
            <th className="px-4 py-2 text-left text-[10px] uppercase font-bold tracking-wider">Barang</th>
            <th className="px-4 py-2 text-center text-[10px] uppercase font-bold tracking-wider">Qty Received</th>
            <th className="px-4 py-2 text-center text-[10px] uppercase font-bold tracking-wider">Qty Invoiced</th>
            <th className="px-4 py-2 text-right text-[10px] uppercase font-bold tracking-wider">Harga Satuan</th>
            <th className="px-4 py-2 text-center text-[10px] uppercase font-bold tracking-wider">PPN %</th>
            <th className="px-4 py-2 text-right text-[10px] uppercase font-bold tracking-wider">Subtotal</th>
            <th className="px-4 py-2 text-center text-[10px] uppercase font-bold tracking-wider">Match Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
          {lines.map((l, index) => {
            const uom = l.uom_invoice ?? l.uom_received ?? "";
            const qtyReceivedDisplay = Number(l.qty_received_invoice_uom ?? l.qty_received);
            const qtyInvoicedDisplay = Number(l.qty_invoiced);
            const unitPricePo = Number(l.unit_price_po ?? 0);
            return (
              <tr key={index} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 dark:text-white">{l.product_name}</p>
                  <p className="text-[10px] text-gray-500 font-mono">{l.product_code}</p>
                </td>
                <td className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">
                  {fmtQty(qtyReceivedDisplay)}
                  {uom ? <span className="text-[10px] text-gray-400 block">{uom}</span> : null}
                  {l.uom_received && uom && l.uom_received !== uom ? (
                    <span className="text-[10px] text-gray-400 block">({fmtQty(l.qty_received)} {l.uom_received} di GR)</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-center font-bold text-gray-900 dark:text-white">
                  {fmtQty(
                    l.uom_received && uom && l.uom_received !== uom &&
                    Math.abs(qtyInvoicedDisplay - l.qty_received) < 0.0001
                      ? qtyReceivedDisplay
                      : qtyInvoicedDisplay,
                  )}
                  {uom ? <span className="text-[10px] text-gray-400 block">{uom}</span> : null}
                </td>
                <td className="px-4 py-3 text-right">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {fmtCurrency(l.unit_price)}
                    {uom ? <span className="text-[10px] text-gray-400 font-normal">/{uom}</span> : null}
                  </p>
                  {Math.abs(l.unit_price - unitPricePo) > 0.01 && (
                    <p className="text-[10px] text-yellow-600 font-medium">
                      PO: {fmtCurrency(unitPricePo)}{uom ? `/${uom}` : ""}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{l.tax_rate}%</td>
                <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">{fmtCurrency(l.total)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    l.match_status === "MATCH" ? "bg-green-100 text-green-700"
                    : l.match_status === "OVER" ? "bg-red-100 text-red-700"
                    : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {l.match_status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
