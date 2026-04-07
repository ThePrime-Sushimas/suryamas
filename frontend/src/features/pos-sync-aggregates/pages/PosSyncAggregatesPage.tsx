import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import { usePosSyncAggregatesStore } from "../store/posSyncAggregates.store";
import { PosSyncAggregatesFilters } from "../components/PosSyncAggregatesFilters";
import type { AggregateStatus } from "../types/pos-sync-aggregates.types";

const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Number(n));

const STATUS_BADGE: Record<AggregateStatus, string> = {
  PENDING:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  READY: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  JOURNALED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

export default function PosSyncAggregatesPage() {
  const navigate = useNavigate();
  const {
    transactions: rows,
    total,
    page,
    limit,
    isLoading: loading,
    fetchTransactions,
    setPage,
  } = usePosSyncAggregatesStore();

  useEffect(() => {
    // User requested to not auto-trigger fetch on initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPages = Math.ceil(total / limit);

  // Summary dari rows yang ter-load
  const summary = rows.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      acc._grand_total = (acc._grand_total ?? 0) + Number(r.grand_total);
      acc._nett = (acc._nett ?? 0) + Number(r.nett_amount);
      acc._fee = (acc._fee ?? 0) + Number(r.total_fee_amount);
      acc._reconciled = (acc._reconciled ?? 0) + (r.is_reconciled ? 1 : 0);
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            POS Sync Aggregates
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {total} records
          </p>
        </div>
        <button
          onClick={() => fetchTransactions(page, limit)}
          className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          {
            label: "Grand Total",
            value: `Rp ${fmt(summary._grand_total ?? 0)}`,
            color: "text-gray-900 dark:text-white",
          },
          {
            label: "Total Fee",
            value: `Rp ${fmt(summary._fee ?? 0)}`,
            color: "text-red-600 dark:text-red-400",
          },
          {
            label: "Nett Amount",
            value: `Rp ${fmt(summary._nett ?? 0)}`,
            color: "text-green-600 dark:text-green-400",
          },
          {
            label: "Pending",
            value: `${summary.PENDING ?? 0} records`,
            color: "text-yellow-600 dark:text-yellow-400",
          },
          {
            label: "Reconciled",
            value: `${summary._reconciled ?? 0} records`,
            color: "text-blue-600 dark:text-blue-400",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-3"
          >
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {card.label}
            </p>
            <p className={`text-sm font-semibold mt-1 ${card.color}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <PosSyncAggregatesFilters />

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                {[
                  "Tanggal",
                  "Cabang",
                  "Payment Method",
                  "Transaksi",
                  "Grand Total",
                  "Fee",
                  "Nett",
                  "Aktual Fee",
                  "Selisih Fee",
                  "Status",
                  "Rekon",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td
                    colSpan={12}
                    className="px-4 py-10 text-center text-sm text-gray-400"
                  >
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-2" />
                    <p>Memuat data...</p>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="px-4 py-10 text-center text-sm text-gray-400"
                  >
                    Tidak ada data
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => navigate(`/pos-sync-aggregates/${row.id}`)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                  >
                    <td className="px-3 py-2.5 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                      {row.sales_date}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {row.branch_name ?? `POS #${row.branch_pos_id}`}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      <div>
                        {row.payment_methods?.name ??
                          `POS #${row.payment_pos_id}`}
                      </div>
                      {row.payment_methods?.payment_type && (
                        <div className="text-xs text-gray-400">
                          {row.payment_methods.payment_type}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-center text-gray-700 dark:text-gray-300">
                      {row.transaction_count}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-right text-gray-900 dark:text-white whitespace-nowrap">
                      Rp {fmt(row.grand_total)}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-right text-red-600 dark:text-red-400 whitespace-nowrap">
                      {Number(row.total_fee_amount) > 0
                        ? `Rp ${fmt(row.total_fee_amount)}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-right text-green-600 dark:text-green-400 whitespace-nowrap font-medium">
                      Rp {fmt(row.nett_amount)}
                    </td>
                    {/* Aktual Fee */}
                    <td className="px-3 py-2.5 text-sm text-right whitespace-nowrap">
                      {row.is_reconciled && row.actual_fee_amount != null ? (
                        <span className="text-gray-700 dark:text-gray-300">
                          Rp {fmt(row.actual_fee_amount)}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">
                          —
                        </span>
                      )}
                    </td>
                    {/* Selisih Fee */}
                    <td className="px-3 py-2.5 text-sm text-right whitespace-nowrap">
                      {row.is_reconciled && row.fee_discrepancy != null ? (
                        <span
                          className={
                            row.fee_discrepancy === 0
                              ? "text-green-600 dark:text-green-400"
                              : row.fee_discrepancy > 0
                                ? "text-red-600 dark:text-red-400"
                                : "text-blue-600 dark:text-blue-400"
                          }
                        >
                          {row.fee_discrepancy === 0
                            ? "✓ 0"
                            : row.fee_discrepancy > 0
                              ? `-Rp ${fmt(row.fee_discrepancy)}`
                              : `+Rp ${fmt(Math.abs(row.fee_discrepancy))}`}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[row.status]}`}
                      >
                        {row.status}
                      </span>
                      {row.recalculated && row.recalculated_count > 1 && (
                        <span
                          title={`Recalculated ${row.recalculated_count}x`}
                          className="ml-1 text-yellow-500"
                        >
                          <AlertTriangle size={12} className="inline" />
                        </span>
                      )}
                    </td>
                    {/* Rekon badge */}
                    <td className="px-3 py-2.5">
                      {row.is_reconciled ? (
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          ✓ Rekon
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                          Belum
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-gray-400">
                      <ChevronRight size={16} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Halaman {page} / {totalPages} · {total} records
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border dark:border-gray-600 rounded disabled:opacity-40 dark:text-gray-300"
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm border dark:border-gray-600 rounded disabled:opacity-40 dark:text-gray-300"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
