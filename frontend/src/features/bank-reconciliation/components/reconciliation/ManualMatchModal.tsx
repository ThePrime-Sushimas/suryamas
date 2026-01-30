import { useState, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  X,
  Search,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  DollarSign,
  Calendar,
  Info,
} from "lucide-react";
import type { DiscrepancyItem } from "../../types/bank-reconciliation.types";
import { posAggregatesApi } from "@/features/pos-aggregates/api/posAggregates.api";
import type { AggregatedTransactionListItem } from "@/features/pos-aggregates/types";

interface ManualMatchModalProps {
  item: DiscrepancyItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    aggregateId: string,
    overrideDifference: boolean,
  ) => Promise<void>;
  isLoading?: boolean;
}

export function ManualMatchModal({
  item,
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: ManualMatchModalProps) {
  const [search, setSearch] = useState("");
  const [aggregates, setAggregates] = useState<AggregatedTransactionListItem[]>(
    [],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overrideDifference, setOverrideDifference] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = useCallback(async () => {
    setIsSearching(true);
    try {
      // Search for unreconciled aggregates around the same date
      const result = await posAggregatesApi.list(1, 20, null, {
        is_reconciled: false,
        search: search || undefined,
        // Optional: filter by date range around the statement date
      });
      setAggregates(result.data);
    } catch (err) {
      console.error("Failed to fetch aggregates:", err);
    } finally {
      setIsSearching(false);
    }
  }, [search]);

  useEffect(() => {
    if (isOpen && item) {
      handleSearch();
    }
  }, [isOpen, item, handleSearch]);

  if (!isOpen || !item) return null;

  const statement = item.statement;
  const bankAmount = (statement?.debit_amount ?? 0) || (statement?.credit_amount ?? 0) || 0;

  const modalContent = (
    <div className="modal modal-open bg-black/40 backdrop-blur-sm">
      <div className="modal-box max-w-4xl bg-white dark:bg-gray-900 p-0 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              Manual Match
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Cocokkan transaksi bank dengan data POS secara manual
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left: Statement Info */}
          <div className="space-y-6">
            <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-2xl p-5">
              <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-4">
                Transaksi Bank
              </h4>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                    <Calendar className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Tanggal</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {statement?.transaction_date}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Nominal</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {bankAmount.toLocaleString("id-ID", {
                        style: "currency",
                        currency: "IDR",
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 pt-2">
                  <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm mt-1">
                    <Info className="w-4 h-4 text-purple-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">Deskripsi</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 break-words leading-relaxed">
                      {statement?.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {selectedId && (
              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800 rounded-2xl p-5 animate-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <h4 className="text-xs font-bold text-amber-600 uppercase tracking-widest">
                    Analisis Kecocokan
                  </h4>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Selisih nominal:
                    </span>
                    <span className="text-sm font-extrabold text-amber-700 dark:text-amber-400">
                      {(
                        bankAmount -
                        (aggregates.find((a) => a.id === selectedId)
                          ?.gross_amount || 0)
                      ).toLocaleString("id-ID")}
                    </span>
                  </div>
                  <label className="flex items-center gap-3 mt-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overrideDifference}
                      onChange={(e) => setOverrideDifference(e.target.checked)}
                      className="checkbox checkbox-sm checkbox-primary rounded-md"
                    />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Konfirmasi perbedaan nominal
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Right: Search & List Aggregates */}
          <div className="flex flex-col h-[400px]">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Cari referensi atau nominal..."
                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 shadow-inner transition-all"
              />
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-white dark:bg-gray-700 text-xs font-bold text-blue-600 dark:text-blue-400 rounded-lg shadow-sm hover:shadow transition-all"
              >
                {isSearching ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  "Search"
                )}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-2 scrollbar-thin">
              {aggregates.map((agg) => (
                <div
                  key={agg.id}
                  onClick={() => setSelectedId(agg.id)}
                  className={`
                    p-4 rounded-2xl border transition-all cursor-pointer relative group
                    ${
                      selectedId === agg.id
                        ? "bg-blue-600 border-blue-600 shadow-lg shadow-blue-500/20"
                        : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-800 hover:border-blue-300 hover:shadow-md"
                    }
                  `}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-bold leading-none ${selectedId === agg.id ? "text-blue-100" : "text-gray-400"}`}
                    >
                      {agg.transaction_date}
                    </span>
                    {selectedId === agg.id && (
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <p
                      className={`font-bold ${selectedId === agg.id ? "text-white" : "text-gray-900 dark:text-white"}`}
                    >
                      {(agg.gross_amount ?? 0).toLocaleString("id-ID")}
                    </p>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${selectedId === agg.id ? "bg-white/20 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-500"}`}
                    >
                      {agg.payment_method_name}
                    </span>
                  </div>
                  <p
                    className={`text-xs mt-1 truncate ${selectedId === agg.id ? "text-blue-100/70" : "text-gray-500"}`}
                  >
                    Ref: {agg.source_ref}
                  </p>
                </div>
              ))}

              {!isSearching && aggregates.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border-2 border-dashed border-gray-100 dark:border-gray-800">
                  <Search className="w-10 h-10 text-gray-200 mb-2" />
                  <p className="text-sm font-medium text-gray-400">
                    Data POS tidak ditemukan
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-all"
          >
            Batal
          </button>
          <button
            disabled={!selectedId || isLoading}
            onClick={() =>
              selectedId && onConfirm(selectedId, overrideDifference)
            }
            className="group px-8 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            Konfirmasi Match
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}
