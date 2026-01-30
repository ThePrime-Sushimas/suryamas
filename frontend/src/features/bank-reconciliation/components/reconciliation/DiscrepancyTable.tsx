import {
  Search,
  Filter,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Undo2,
} from "lucide-react";
import type { DiscrepancyItem } from "../../types/bank-reconciliation.types";
import { DISCREPANCY_REASON_LABELS } from "../../constants/bank-reconciliation.constants";

interface DiscrepancyTableProps {
  items: DiscrepancyItem[];
  onManualMatch: (item: DiscrepancyItem) => void;
  onUndo: (statementId: string) => void;
}

export function DiscrepancyTable({
  items,
  onManualMatch,
  onUndo,
}: DiscrepancyTableProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Daftar Discrepancy
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Transaksi yang memerlukan peninjauan manual
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cari transaksi..."
              className="pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 w-64"
            />
          </div>
          <button className="p-2 bg-gray-50 dark:bg-gray-900 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <Filter className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-gray-900/50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th className="px-6 py-4">Tanggal & Deskripsi</th>
              <th className="px-6 py-4">Nominal Bank</th>
              <th className="px-6 py-4">Nominal POS</th>
              <th className="px-6 py-4">Selisih</th>
              <th className="px-6 py-4">Alasan</th>
              <th className="px-6 py-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((item) => (
              <tr
                key={item.statementId}
                className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-colors group"
              >
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {item.statement?.transaction_date || "N/A"}
                    </span>
                    <span className="text-xs text-gray-500 truncate max-w-[200px]">
                      {item.statement?.description || "No description"}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {((item.statement?.debit_amount ?? 0) || (item.statement?.credit_amount ?? 0) || 0).toLocaleString("id-ID")}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {item.statement?.matched_aggregate
                      ? (item.statement.matched_aggregate.gross_amount ?? 0).toLocaleString("id-ID")
                      : "-"}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-sm font-bold ${(item.difference ?? 0) === 0 ? "text-green-600" : "text-rose-600"}`}
                    >
                      {(item.difference ?? 0).toLocaleString("id-ID")}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider
                    ${
                      item.severity === "HIGH"
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                        : item.severity === "MEDIUM"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    }`}
                  >
                    <AlertCircle className="w-3 h-3" />
                    {DISCREPANCY_REASON_LABELS[item.reason]}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.statement?.is_reconciled ? (
                      <button
                        onClick={() => onUndo(item.statementId)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        Revert
                      </button>
                    ) : (
                      <button
                        onClick={() => onManualMatch(item)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 shadow-sm hover:shadow-blue-500/20 transition-all"
                      >
                        Match
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3 opacity-20" />
                  <p className="font-medium text-lg">Semua transaksi cocok!</p>
                  <p className="text-sm">
                    Tidak ada discrepancy yang perlu ditangani saat ini.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
