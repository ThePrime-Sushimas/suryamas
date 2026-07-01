import { ClipboardCheck, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PurchaseInvoicePaymentDue } from "./PurchaseInvoicePaymentDue";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { fmtDate, fmtCurrency } from "../utils/purchaseInvoice.formatters";
import type { PurchaseInvoice } from "../api/purchaseInvoices.api";
import type { MouseEvent } from "react";

interface InvoiceTableDesktopProps {
  invoices: PurchaseInvoice[];
  isLoading: boolean;
  tab: string;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onRowClick: (id: string) => void;
  // post/unpost
  canUpdate: boolean;
  canRelease: boolean;
  postingId: string | null;
  isUnpostPending: boolean;
  disabledHint: string;
  onPostJournal: (e: MouseEvent, inv: PurchaseInvoice) => void;
  onUnpostClick: (inv: PurchaseInvoice) => void;
  // delete
  onDeleteClick: (inv: PurchaseInvoice) => void;
}

export function InvoiceTableDesktop({
  invoices,
  isLoading,
  tab,
  selectedIds,
  onToggleSelect,
  onRowClick,
  canUpdate,
  canRelease,
  postingId,
  isUnpostPending,
  disabledHint,
  onPostJournal,
  onUnpostClick,
  onDeleteClick,
}: InvoiceTableDesktopProps) {
  const colSpan = tab === "verify" ? 9 : 8;

  return (
    <div className="hidden lg:block overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
          <tr>
            {tab === "verify" && (
              <th className="w-10 px-4 py-3">
                <input type="checkbox" disabled />
              </th>
            )}
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              No. Invoice
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Supplier
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Cabang
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Tanggal
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Jatuh Tempo
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Total
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Aksi
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <td colSpan={colSpan} className="px-4 py-4">
                  <div className="h-4 bg-gray-100 dark:bg-gray-700/50 rounded animate-pulse" />
                </td>
              </tr>
            ))
          ) : invoices.length === 0 ? (
            <tr>
              <td
                colSpan={colSpan}
                className="px-4 py-12 text-center text-gray-400 dark:text-gray-500"
              >
                Tidak ada invoice ditemukan
              </td>
            </tr>
          ) : (
            invoices.map((inv) => (
              <tr
                key={inv.id}
                onClick={() => onRowClick(inv.id)}
                className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors group ${
                  selectedIds.includes(inv.id)
                    ? "bg-indigo-50/50 dark:bg-indigo-900/10"
                    : ""
                }`}
              >
                {tab === "verify" && (
                  <td
                    className="px-4 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(inv.id)}
                      onChange={() => onToggleSelect(inv.id)}
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                )}
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {inv.invoice_number}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    {inv.goods_receipt_count} GR
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {inv.supplier_name}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                  {inv.branch_name}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                  {fmtDate(inv.invoice_date)}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                  <PurchaseInvoicePaymentDue
                    info={inv.payment_due_info}
                    variant="table"
                  />
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                  {fmtCurrency(Number(inv.total_amount))}
                </td>
                <td className="px-4 py-3 text-center">
                  <InvoiceStatusBadge status={inv.status} />
                </td>
                <td
                  className="px-4 py-3 text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {tab === "final" && inv.status === "POSTED" && canRelease && (
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<Undo2 className="w-3.5 h-3.5 shrink-0" />}
                        disabled={isUnpostPending}
                        onClick={(e) => { e.stopPropagation(); onUnpostClick(inv); }}
                        className="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-200"
                      >
                        Batalkan Post
                      </Button>
                    )}
                    {tab === "final" && inv.status === "APPROVED" && canUpdate && (
                      <Button
                        variant="primary"
                        size="sm"
                        leftIcon={<ClipboardCheck className="w-3.5 h-3.5 shrink-0" />}
                        loading={postingId === inv.id}
                        disabled={!inv.post_journal_ready || postingId !== null}
                        title={inv.post_journal_ready ? undefined : disabledHint}
                        onClick={(e) => onPostJournal(e, inv)}
                      >
                        Post Jurnal
                      </Button>
                    )}
                    {inv.status === "DRAFT" && canRelease && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); onDeleteClick(inv); }}
                        className="text-red-500"
                      >
                        Hapus
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
