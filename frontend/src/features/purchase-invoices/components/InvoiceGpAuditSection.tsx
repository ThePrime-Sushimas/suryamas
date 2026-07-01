import { useNavigate } from "react-router-dom";
import { Package, AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";
import { fmtDate, fmtQty } from "../utils/purchaseInvoice.formatters";
import {
  GP_LINE_STATUS_CONFIG,
  normalizeGpLineStatus,
} from "../types/purchaseInvoice.status";
import type { PurchaseInvoiceGpLineAudit } from "../api/purchaseInvoices.api";

interface InvoiceGpAuditSectionProps {
  gpAuditsByDoc: Map<string, PurchaseInvoiceGpLineAudit[]>;
  allGpLinesConfirmed: boolean;
  hasUnconfirmedGp: boolean;
  invoiceStatus: string;
}

export function InvoiceGpAuditSection({
  gpAuditsByDoc,
  allGpLinesConfirmed,
  hasUnconfirmedGp,
  invoiceStatus,
}: InvoiceGpAuditSectionProps) {
  const navigate = useNavigate();

  if (gpAuditsByDoc.size === 0) return null;

  return (
    <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-700">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="w-4 h-4 text-orange-500" />
            Riwayat Barang Masuk (QC)
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Prasyarat post jurnal: semua item harus status{" "}
            <span className="font-semibold text-green-600">Selesai</span>
            . Post jurnal dilakukan dari daftar Invoice, tab{" "}
            <span className="font-medium">Selesai & Posting</span>.
          </p>
        </div>

        {invoiceStatus === "APPROVED" && hasUnconfirmedGp && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 max-w-md">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Masih ada item yang belum dikonfirmasi di Barang Masuk. Selesaikan
              QC sebelum memposting jurnal dari daftar (tab Selesai & Posting).
            </span>
          </div>
        )}

        {allGpLinesConfirmed && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
            <CheckCircle2 className="w-3 h-3" /> Siap post dari daftar
          </span>
        )}
      </div>

      <div className="space-y-4">
        {[...gpAuditsByDoc.entries()].map(([gpNumber, rows]) => (
          <div
            key={gpNumber}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
          >
            <div className="px-4 py-2.5 bg-orange-50/80 dark:bg-orange-900/10 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-semibold text-gray-800 dark:text-gray-200">
                {gpNumber}
              </span>
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/inventory/goods-processing/${rows[0].goods_processing_id}`,
                  )
                }
                className="text-[10px] font-medium text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1"
              >
                Buka di Barang Masuk
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {rows.map((row) => {
                const st =
                  GP_LINE_STATUS_CONFIG[normalizeGpLineStatus(row.gp_line_status)] ??
                  GP_LINE_STATUS_CONFIG.PENDING;
                const goodOutputs = row.outputs.filter((o) => !o.is_waste);

                return (
                  <div
                    key={row.gp_input_id}
                    className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {row.product_name}
                        </span>
                        <span className="text-[10px] font-mono text-gray-400">
                          {row.product_code}
                        </span>
                        {row.requires_processing ? (
                          <span className="px-1.5 py-0.5 text-[10px] rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                            Proses
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 text-[10px] rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                            Pass
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${st.color}`}
                        >
                          {st.label}
                        </span>
                      </div>

                      <p className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                        {fmtQty(row.qty_input)} {row.uom}
                      </p>

                      {goodOutputs.length > 0 &&
                        goodOutputs.some(
                          (o) => o.product_name !== row.product_name,
                        ) && (
                          <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                            →{" "}
                            {goodOutputs
                              .map(
                                (o) =>
                                  `${o.product_name} ${fmtQty(o.qty_output)} ${o.uom}`,
                              )
                              .join(" + ")}
                          </p>
                        )}

                      {row.gp_line_status === "CONFIRMED" &&
                        row.qc_confirmed_at && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                            ✓ Dikonfirmasi oleh{" "}
                            {row.qc_confirmed_by_name ?? "QC"} ·{" "}
                            {fmtDate(row.qc_confirmed_at)}
                          </p>
                        )}

                      {row.gp_line_status === "REJECTED" &&
                        row.rejection_reason && (
                          <p className="text-xs text-red-500 mt-1 italic">
                            {row.rejection_reason}
                          </p>
                        )}

                      {row.processed_at &&
                        row.gp_line_status !== "CONFIRMED" && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Diproses{" "}
                            {row.processed_by_name
                              ? `oleh ${row.processed_by_name}`
                              : ""}{" "}
                            · {fmtDate(row.processed_at)}
                          </p>
                        )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/inventory/goods-processing/${row.goods_processing_id}?line=${row.gp_input_id}`,
                        )
                      }
                      className="shrink-0 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Detail item
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
