import { useState, useEffect } from "react";
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
import type { BankStatementWithMatch } from "../../types/bank-reconciliation.types";
import { posAggregatesApi } from "@/features/pos-aggregates/api/posAggregates.api";
import type { AggregatedTransactionListItem, AggregatedTransactionFilterParams } from "@/features/pos-aggregates/types";
import { tailwindTheme } from "@/lib/tailwind-theme";

interface ManualMatchModalProps {
  item: BankStatementWithMatch | null;
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

  const handleSearch = async () => {
    setIsSearching(true);
    try {
      const filter: AggregatedTransactionFilterParams = {
        is_reconciled: false,
        search: search || undefined,
      };
      const result = await posAggregatesApi.list(1, 500, null, filter);
      setAggregates(result.data);
    } catch (err) {
      console.error("Failed to fetch aggregates:", err);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (isOpen && item) {
      setSearch("");
      setSelectedId(null);
      setOverrideDifference(false);
      setIsSearching(true);
      posAggregatesApi.list(1, 500, null, { is_reconciled: false })
        .then((result) => setAggregates(result.data))
        .catch((err) => console.error("Failed to fetch aggregates:", err))
        .finally(() => setIsSearching(false));
    }
  }, [isOpen, item]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const statement = item;
  const bankAmount =
    (statement?.debit_amount ?? 0) || (statement?.credit_amount ?? 0) || 0;

  if (!isOpen || !item) return null;

  const modalContent = (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Slide-out Panel */}
      <div className="relative h-full w-full max-w-2xl animate-in slide-in-from-right duration-300">
        <div className="flex h-full flex-col bg-white dark:bg-gray-900 shadow-2xl">
          {/* Header */}
          <div className="relative bg-linear-to-br from-blue-600 to-indigo-700 px-6 py-8">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 rounded-full blur-3xl opacity-50" />
            <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-blue-400/20 rounded-full blur-2xl opacity-50" />

            <div className="relative flex items-start justify-between">
              <div>
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  Manual Match
                </h3>
                <p className="text-blue-100/80 mt-2 text-sm max-w-md leading-relaxed font-medium">
                  Cocokkan transaksi bank dengan data POS secara manual
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                aria-label="Tutup modal"
              >
                <X className="w-5 h-5 text-white/70" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin">
            <div className="space-y-6">
              {/* Statement Info */}
              <div className={`${tailwindTheme.colors.info.bg} ${tailwindTheme.colors.info.border} border rounded-2xl p-5 shadow-sm`}>
                <h4 className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-4">
                  Transaksi Bank
                </h4>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                      <Calendar className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 font-bold uppercase">Tanggal</p>
                      <p className={`${tailwindTheme.typography.body} font-bold text-gray-900 dark:text-white`}>
                        {statement?.transaction_date}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                      <DollarSign className="w-4 h-4 text-green-500" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 font-bold uppercase">Nominal</p>
                      <p className={`${tailwindTheme.typography.display} text-gray-900 dark:text-white`}>
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
                      <p className="text-[10px] text-gray-500 font-bold uppercase">Deskripsi</p>
                      <p className={`${tailwindTheme.typography.body} text-gray-700 dark:text-gray-300 leading-relaxed`}>
                        {statement?.description}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fee Breakdown (if aggregate selected) */}
              {selectedId && aggregates.find((a) => a.id === selectedId) && (
                <div className={`${tailwindTheme.colors.accent.bg} ${tailwindTheme.colors.accent.border} border rounded-2xl p-5 shadow-sm space-y-3`}>
                  <h4 className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-3">
                    Breakdown Fee POS
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400 font-medium">Gross Amount:</span>
                      <span className="font-bold text-gray-900 dark:text-white">
                        {(aggregates.find((a) => a.id === selectedId)?.gross_amount || 0).toLocaleString("id-ID", {
                          style: "currency",
                          currency: "IDR",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400 font-medium">Percentage Fee:</span>
                      <span className="font-bold text-purple-700 dark:text-purple-400">
                        - {(aggregates.find((a) => a.id === selectedId)?.percentage_fee_amount || 0).toLocaleString("id-ID", {
                          style: "currency",
                          currency: "IDR",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400 font-medium">Fixed Fee:</span>
                      <span className="font-bold text-purple-700 dark:text-purple-400">
                        - {(aggregates.find((a) => a.id === selectedId)?.fixed_fee_amount || 0).toLocaleString("id-ID", {
                          style: "currency",
                          currency: "IDR",
                        })}
                      </span>
                    </div>
                    <div className="h-px bg-purple-200 dark:bg-purple-800 my-2" />
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400 font-bold">Total Fee:</span>
                      <span className="font-bold text-purple-700 dark:text-purple-400">
                        - {(aggregates.find((a) => a.id === selectedId)?.total_fee_amount || 0).toLocaleString("id-ID", {
                          style: "currency",
                          currency: "IDR",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-purple-300 dark:border-purple-700">
                      <span className="font-bold text-gray-700 dark:text-gray-300">Nett Amount:</span>
                      <span className="font-extrabold text-xl text-purple-900 dark:text-purple-300">
                        {(aggregates.find((a) => a.id === selectedId)?.nett_amount || 0).toLocaleString("id-ID", {
                          style: "currency",
                          currency: "IDR",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Difference Analysis */}
              {selectedId && (
                <div className={`${tailwindTheme.colors.warning.bg} ${tailwindTheme.colors.warning.border} border rounded-2xl p-5 shadow-sm animate-in slide-in-from-top-2 duration-300`}>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-4 h-4 text-orange-600" />
                    <h4 className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">
                      Analisis Kecocokan
                    </h4>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Selisih nominal:</span>
                      <span className="text-sm font-extrabold text-orange-700 dark:text-orange-400">
                        {(bankAmount - (aggregates.find((a) => a.id === selectedId)?.nett_amount || 0)).toLocaleString("id-ID", {
                          style: "currency",
                          currency: "IDR",
                        })}
                      </span>
                    </div>
                    <label className="flex items-center gap-3 mt-4 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={overrideDifference}
                          onChange={(e) => setOverrideDifference(e.target.checked)}
                          className="peer sr-only"
                        />
                        <div className="w-10 h-6 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:bg-orange-600 transition-colors" />
                        <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full peer-checked:translate-x-4 transition-transform" />
                      </div>
                      <span className="text-sm font-bold text-gray-700 dark:text-gray-300 group-hover:text-orange-600 transition-colors">
                        Konfirmasi perbedaan nominal
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* Search & List Aggregates */}
              <div>
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                  Pilih Transaksi POS
                </h4>
                <div className="relative mb-4">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="Cari referensi atau nominal..."
                    className={tailwindTheme.components.input}
                  />
                  <button
                    onClick={handleSearch}
                    disabled={isSearching}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg shadow-sm hover:bg-blue-700 transition-all disabled:opacity-50"
                  >
                    {isSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : "CARI"}
                  </button>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
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
                          className={`text-[10px] font-bold leading-none ${selectedId === agg.id ? "text-blue-100" : "text-gray-400"}`}
                        >
                          {agg.transaction_date}
                        </span>
                        {selectedId === agg.id && (
                          <CheckCircle2 className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className={`font-extrabold ${selectedId === agg.id ? "text-white" : "text-gray-900 dark:text-white"}`}>
                          {(agg.nett_amount ?? 0).toLocaleString("id-ID")}
                        </p>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${selectedId === agg.id ? "bg-white/20 text-white" : "bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"}`}
                        >
                          {agg.payment_method_name}
                        </span>
                      </div>
                      <p className={`text-[10px] font-medium mt-1 truncate ${selectedId === agg.id ? "text-blue-100/70" : "text-gray-500"}`}>
                        Ref: {agg.source_ref}
                      </p>
                    </div>
                  ))}

                  {!isSearching && aggregates.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-40 text-center p-6 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border-2 border-dashed border-gray-100 dark:border-gray-800">
                      <Search className="w-10 h-10 text-gray-200 mb-2" />
                      <p className="text-sm font-bold text-gray-400 italic">
                        Data POS tidak ditemukan
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/80 px-6 py-5 flex items-center justify-end gap-4">
            <button onClick={onClose} className={tailwindTheme.components.secondaryButton}>
              Batal
            </button>
            <button
              disabled={!selectedId || isLoading}
              onClick={() => selectedId && onConfirm(selectedId, overrideDifference)}
              className={`${tailwindTheme.components.primaryButton} flex items-center gap-2 px-8`}
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
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}

