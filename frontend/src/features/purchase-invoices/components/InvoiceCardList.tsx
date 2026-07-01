import { CheckSquare, Square, ClipboardCheck, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { PurchaseInvoicePaymentDue } from "./PurchaseInvoicePaymentDue";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { fmtDate, fmtCurrency } from "@/lib/formatters";
import type { PurchaseInvoice } from "../api/purchaseInvoices.api";
import type { MouseEvent } from "react";

interface InvoiceCardListProps {
  invoices: PurchaseInvoice[];
  isLoading: boolean;
  tab: string;
  isSelectionMode: boolean;
  selectedIds: string[];
  onCardClick: (inv: PurchaseInvoice) => void;
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

export function InvoiceCardList({
  invoices,
  isLoading,
  tab,
  isSelectionMode,
  selectedIds,
  onCardClick,
  canUpdate,
  canRelease,
  postingId,
  isUnpostPending,
  disabledHint,
  onPostJournal,
  onUnpostClick,
  onDeleteClick,
}: InvoiceCardListProps) {
  return (
    <div className="lg:hidden">
      {isLoading ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <div className="px-4 py-12 text-center text-gray-400 dark:text-gray-500">
          Tidak ada invoice ditemukan
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
          {invoices.map((inv) => (
            <div
              key={inv.id}
              onClick={() => onCardClick(inv)}
              className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer active:bg-gray-100 dark:active:bg-gray-700/50 transition-colors relative ${
                selectedIds.includes(inv.id)
                  ? "bg-indigo-50/50 dark:bg-indigo-900/10"
                  : ""
              }`}
            >
              {isSelectionMode && (
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  {selectedIds.includes(inv.id) ? (
                    <CheckSquare className="w-5 h-5 text-indigo-600" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-300" />
                  )}
                </div>
              )}

              <div className={`flex flex-col ${isSelectionMode ? "pl-8" : ""}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 dark:text-white truncate">
                      {inv.invoice_number}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {inv.supplier_name}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <InvoiceStatusBadge status={inv.status} />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                <div className="flex items-center gap-2">
                  <span>{fmtDate(inv.invoice_date)}</span>
                  <span>·</span>
                  <span>{inv.branch_code}</span>
                </div>
                <div className="font-bold text-gray-900 dark:text-white">
                  {fmtCurrency(Number(inv.total_amount))}
                </div>
              </div>

              {inv.payment_due_info && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Jatuh tempo:{" "}
                  <PurchaseInvoicePaymentDue
                    info={inv.payment_due_info}
                    variant="inline"
                  />
                </p>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-gray-50 dark:border-gray-700/50">
                <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-medium mr-auto">
                  {inv.goods_receipt_count} Goods Receipt
                </div>

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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
