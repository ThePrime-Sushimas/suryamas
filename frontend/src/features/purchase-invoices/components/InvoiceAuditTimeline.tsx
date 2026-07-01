import {
  Plus,
  Send,
  XCircle,
  CheckCircle2,
  FileText,
  ClipboardCheck,
} from "lucide-react";
import { fmtDateTime } from "@/lib/formatters";
import type { PurchaseInvoiceDetail } from "../api/purchaseInvoices.api";

interface InvoiceAuditTimelineProps {
  inv: PurchaseInvoiceDetail;
}

export function InvoiceAuditTimeline({ inv }: InvoiceAuditTimelineProps) {
  return (
    <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-700">
      <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
        <ClipboardCheck className="w-4 h-4 text-indigo-500" /> Riwayat
        Verifikasi Invoice
      </h3>

      <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-linear-to-b before:from-indigo-500 before:via-gray-200 dark:before:via-gray-700 before:to-transparent">
        {/* Created */}
        <div className="relative flex items-center justify-between md:justify-start">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow shrink-0 md:order-1 border-4 border-white dark:border-gray-800">
            <Plus className="w-5 h-5" />
          </div>
          <div className="flex-1 ml-4 md:order-2">
            <div className="flex items-center justify-between mb-1">
              <div className="font-bold text-gray-900 dark:text-white text-sm">
                Draft Dibuat
              </div>
              <time className="text-[10px] font-mono text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full">
                {fmtDateTime(inv.created_at)}
              </time>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Oleh:{" "}
              <span className="font-medium text-gray-700 dark:text-gray-200">
                {inv.creator_name || "System"}
              </span>
            </div>
          </div>
        </div>

        {/* Submitted */}
        {inv.submitted_at && (
          <div className="relative flex items-center justify-between md:justify-start">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 shadow shrink-0 md:order-1 border-4 border-white dark:border-gray-800">
              <Send className="w-4 h-4" />
            </div>
            <div className="flex-1 ml-4 md:order-2">
              <div className="flex items-center justify-between mb-1">
                <div className="font-bold text-gray-900 dark:text-white text-sm">
                  Diajukan untuk Verifikasi
                </div>
                <time className="text-[10px] font-mono text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                  {fmtDateTime(inv.submitted_at)}
                </time>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Oleh:{" "}
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {inv.submitter_name || "Staff Finance"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Rejected */}
        {inv.status === "REJECTED" && inv.rejected_at && (
          <div className="relative flex items-center justify-between md:justify-start">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 shadow shrink-0 md:order-1 border-4 border-white dark:border-gray-800">
              <XCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 ml-4 md:order-2">
              <div className="flex items-center justify-between mb-1">
                <div className="font-bold text-red-600 dark:text-red-400 text-sm">
                  Ditolak
                </div>
                <time className="text-[10px] font-mono text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
                  {fmtDateTime(inv.rejected_at)}
                </time>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Oleh:{" "}
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {inv.rejector_name || "Approver"}
                </span>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-lg text-xs text-red-700 dark:text-red-300 italic">
                {inv.rejection_reason}
              </div>
            </div>
          </div>
        )}

        {/* Approved */}
        {inv.approved_at && (
          <div className="relative flex items-center justify-between md:justify-start">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 shadow shrink-0 md:order-1 border-4 border-white dark:border-gray-800">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="flex-1 ml-4 md:order-2">
              <div className="flex items-center justify-between mb-1">
                <div className="font-bold text-gray-900 dark:text-white text-sm">
                  Disetujui
                </div>
                <time className="text-[10px] font-mono text-green-500 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                  {fmtDateTime(inv.approved_at)}
                </time>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Oleh:{" "}
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {inv.approver_name || "Manager"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Posted */}
        {inv.posted_at && (
          <div className="relative flex items-center justify-between md:justify-start">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow shrink-0 md:order-1 border-4 border-white dark:border-gray-800">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 ml-4 md:order-2">
              <div className="flex items-center justify-between mb-1">
                <div className="font-bold text-gray-900 dark:text-white text-sm">
                  Berhasil Di-post ke Jurnal
                </div>
                <time className="text-[10px] font-mono text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">
                  {fmtDateTime(inv.posted_at)}
                </time>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Oleh:{" "}
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {inv.poster_name || "Accounting"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
