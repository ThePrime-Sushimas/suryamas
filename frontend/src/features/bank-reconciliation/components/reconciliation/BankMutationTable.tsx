import { useState } from "react";
import {
  Search,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Undo2,
  HelpCircle,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import type {
  BankStatementWithMatch,
  BankReconciliationStatus,
  PotentialMatch,
} from "../../types/bank-reconciliation.types";

interface BankMutationTableProps {
  items: BankStatementWithMatch[];
  potentialMatchesMap?: Record<string, PotentialMatch[]>;
  isLoadingMatches?: Record<string, boolean>;
  onManualMatch: (item: BankStatementWithMatch) => void;
  onQuickMatch: (item: BankStatementWithMatch, aggregateId: string) => void;
  onCheckMatches?: (statementId: string) => void;
  onUndo: (statementId: string) => void;
}

export function BankMutationTable({
  items,
  potentialMatchesMap = {},
  isLoadingMatches = {},
  onManualMatch,
  onQuickMatch,
  onCheckMatches,
  onUndo,
}: BankMutationTableProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "ALL" | "UNRECONCILED" | "RECONCILED" | "DISCREPANCY"
  >("ALL");

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.description?.toLowerCase().includes(search.toLowerCase()) ||
      item.reference_number?.toLowerCase().includes(search.toLowerCase());

    if (filter === "ALL") return matchesSearch;
    if (filter === "UNRECONCILED")
      return (
        matchesSearch && !item.is_reconciled && item.status !== "DISCREPANCY"
      );
    if (filter === "RECONCILED") return matchesSearch && item.is_reconciled;
    if (filter === "DISCREPANCY")
      return matchesSearch && item.status === "DISCREPANCY";
    return matchesSearch;
  });

  const getStatusBadge = (status: BankReconciliationStatus) => {
    switch (status) {
      case "AUTO_MATCHED":
      case "MANUALLY_MATCHED":
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="w-3 h-3" />
            Reconciled
          </div>
        );
      case "DISCREPANCY":
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
            <AlertCircle className="w-3 h-3" />
            Discrepancy
          </div>
        );
      case "PENDING":
      case "UNRECONCILED":
      default:
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            <HelpCircle className="w-3 h-3" />
            Unreconciled
          </div>
        );
    }
  };

const calculateDifference = (item: BankStatementWithMatch) => {
    if (!item.is_reconciled || !item.matched_aggregate) return 0;
    const bankAmount = item.credit_amount - item.debit_amount;
    return Math.abs(bankAmount - item.matched_aggregate.nett_amount);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Mutasi Bank
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Daftar transaksi bank dan status rekonsiliasi
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari transaksi..."
              className="pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 w-64"
            />
          </div>

          <select
            value={filter}
            onChange={(e) =>
              setFilter(
                e.target.value as
                  | "ALL"
                  | "UNRECONCILED"
                  | "RECONCILED"
                  | "DISCREPANCY",
              )
            }
            className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-400 focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">Semua</option>
            <option value="UNRECONCILED">Belum Cocok</option>
            <option value="RECONCILED">Terekonsiliasi</option>
            <option value="DISCREPANCY">Selisih</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-gray-900/50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th className="px-6 py-4">Tanggal & Deskripsi</th>
              <th className="px-6 py-4 text-right">Debit</th>
              <th className="px-6 py-4 text-right">Kredit</th>
              <th className="px-6 py-4 text-right">POS Match</th>
              <th className="px-6 py-4 text-right">Selisih</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredItems.map((item) => (
              <tr
                key={item.id}
                className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-colors group"
              >
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {new Date(item.transaction_date).toLocaleDateString(
                        "id-ID",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        },
                      )}
                    </span>
                    <span
                      className="text-xs text-gray-500 truncate max-w-[250px]"
                      title={item.description}
                    >
                      {item.description || "No description"}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-sm font-medium text-rose-600">
                    {item.debit_amount > 0
                      ? item.debit_amount.toLocaleString("id-ID")
                      : "-"}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-sm font-medium text-green-600">
                    {item.credit_amount > 0
                      ? item.credit_amount.toLocaleString("id-ID")
                      : "-"}
                  </span>
                </td>
<td className="px-6 py-4 text-right">
                  <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                    {item.matched_aggregate
                      ? item.matched_aggregate.nett_amount.toLocaleString(
                          "id-ID",
                        )
                      : "-"}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span
                    className={`text-sm font-bold ${calculateDifference(item) === 0 ? "text-gray-400" : "text-rose-600"}`}
                  >
                    {calculateDifference(item) > 0
                      ? calculateDifference(item).toLocaleString("id-ID")
                      : "-"}
                  </span>
                </td>
                <td className="px-6 py-4">{getStatusBadge(item.status)}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!item.is_reconciled && (
                      <>
                        {(potentialMatchesMap[item.id]?.length ?? 0) > 0 ? (
<button
                            onClick={() =>
                              onQuickMatch(
                                item,
                                potentialMatchesMap[item.id]![0].id,
                              )
                            }
                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-all shadow-sm"
                            title={`Cocokkan dengan ${potentialMatchesMap[item.id]![0].payment_method_name}`}
                          >
                            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                            Match{" "}
                            {potentialMatchesMap[
                              item.id
                            ]![0].nett_amount.toLocaleString("id-ID")}
                          </button>
                        ) : (
                          <button
                            onClick={() => onCheckMatches?.(item.id)}
                            disabled={isLoadingMatches[item.id]}
                            className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold hover:bg-gray-100 transition-all disabled:opacity-50"
                          >
                            {isLoadingMatches[item.id] ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                            )}
                            Saran
                          </button>
                        )}
                      </>
                    )}
                    {item.is_reconciled ? (
                      <button
                        onClick={() => onUndo(item.id)}
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
                  colSpan={7}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3 opacity-20" />
                  <p className="font-medium text-lg">Tidak ada data mutasi</p>
                  <p className="text-sm">
                    Silakan pilih rentang tanggal atau akun bank lain.
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
