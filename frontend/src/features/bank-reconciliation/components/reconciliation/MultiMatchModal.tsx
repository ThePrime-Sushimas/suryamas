import { useState, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import {
  X,
  Search,
  AlertCircle,
  Loader2,
  Link2,
  Wallet,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { BankStatementWithMatch } from "../../types/bank-reconciliation.types";
import type { AggregatedTransactionListItem } from "@/features/pos-aggregates/types";

// Helper function untuk normalisasi ID ke string
const normalizeId = (id: string | number): string => String(id);

// BankIcon component - dipindahkan ke atas untuk kejelasan
function BankIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
    </svg>
  );
}

interface MultiMatchModalProps {
  aggregate: AggregatedTransactionListItem | null;
  statements: BankStatementWithMatch[];
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    aggregateId: string,
    statementIds: string[],
    overrideDifference: boolean,
  ) => Promise<void>;
  isLoading?: boolean;
  initialStatements?: BankStatementWithMatch[];
  onFindAggregate?: (statementIds: string[]) => Promise<AggregatedTransactionListItem | null>;
  // Props baru untuk pemilihan aggregate manual
  availableAggregates?: AggregatedTransactionListItem[];
  onLoadAggregates?: () => Promise<AggregatedTransactionListItem[]>;
}

export function MultiMatchModal({
  aggregate,
  statements,
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  initialStatements = [],
  onFindAggregate,
  availableAggregates = [],
  onLoadAggregates,
}: MultiMatchModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [overrideDifference, setOverrideDifference] = useState(false);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"aggregate-first" | "statements-first">("aggregate-first");
  const [isFindingAggregate, setIsFindingAggregate] = useState(false);
  const [aggregateSearch, setAggregateSearch] = useState("");
  const [showAggregateList, setShowAggregateList] = useState(false);
  const [localAggregate, setLocalAggregate] = useState<AggregatedTransactionListItem | null>(aggregate);
  const [aggregates, setAggregates] = useState<AggregatedTransactionListItem[]>(availableAggregates);
  const [isLoadingAggregates, setIsLoadingAggregates] = useState(false);

  // Hapus useEffect sync yang tidak perlu karena state sudah diinisialisasi dari props
  // Update localAggregate hanya dilakukan secara manual melalui setLocalAggregate

  // Load aggregates jika prop onLoadAggregates tersedia
  const handleLoadAggregates = async () => {
    if (!onLoadAggregates || isLoadingAggregates) return;
    setIsLoadingAggregates(true);
    try {
      const result = await onLoadAggregates();
      setAggregates(result);
    } catch (err) {
      console.error("Error loading aggregates:", err);
    } finally {
      setIsLoadingAggregates(false);
    }
  };

  // Toggle aggregate list dropdown
  const toggleAggregateList = async () => {
    if (!showAggregateList && aggregates.length === 0 && onLoadAggregates) {
      await handleLoadAggregates();
    }
    setShowAggregateList(!showAggregateList);
  };

  // Select aggregate dari list
  const handleSelectAggregate = (agg: AggregatedTransactionListItem) => {
    setLocalAggregate(agg);
    setMode("aggregate-first");
    setShowAggregateList(false);
  };

  // Reset state when modal opens - hanya jalankan sekali saat isOpen berubah ke true
  useEffect(() => {
    if (isOpen) {
      setOverrideDifference(false);
      setAggregateSearch("");
      setShowAggregateList(false);
      
      if (initialStatements.length > 0) {
        setMode("statements-first");
        // Pastikan semua ID adalah string dengan menggunakan normalizeId
        setSelectedIds(initialStatements.map(s => normalizeId(s.id)));
      } else {
        setMode("aggregate-first");
        setSelectedIds([]);
      }
    }
  }, [isOpen, initialStatements]);

  // Filter statements by search
  const filteredStatements = useMemo(() => {
    if (!search) return statements;
    const searchLower = search.toLowerCase();
    return statements.filter(
      (s) =>
        s.description?.toLowerCase().includes(searchLower) ||
        normalizeId(s.id).toLowerCase().includes(searchLower),
    );
  }, [statements, search]);

  // Filter aggregates by search
  const filteredAggregates = useMemo(() => {
    if (!aggregateSearch) return aggregates;
    const searchLower = aggregateSearch.toLowerCase();
    return aggregates.filter(
      (agg) =>
        agg.source_ref?.toLowerCase().includes(searchLower) ||
        agg.payment_method_name?.toLowerCase().includes(searchLower) ||
        agg.nett_amount?.toString().includes(searchLower),
    );
  }, [aggregates, aggregateSearch]);

  // Calculate totals dengan useMemo untuk akurasi
  const selectedStatements = useMemo(() => {
    return statements.filter((s) => 
      selectedIds.includes(normalizeId(s.id))
    );
  }, [statements, selectedIds]);

  const totalSelected = selectedStatements.reduce((sum, s) => {
    const amount = (s.credit_amount || 0) - (s.debit_amount || 0);
    return sum + amount;
  }, 0);

  const aggregateAmount = localAggregate?.nett_amount || 0;
  const difference = totalSelected - aggregateAmount;
  const differencePercent = aggregateAmount !== 0 ? Math.abs(difference) / aggregateAmount * 100 : 0;
  const isWithinTolerance = differencePercent <= 5;

  // Memo untuk cek apakah semua statement tercentang
  const isAllSelected = useMemo(() => {
    return filteredStatements.length > 0 && 
      filteredStatements.every(s => selectedIds.includes(normalizeId(s.id)));
  }, [filteredStatements, selectedIds]);

  const handleToggleStatement = (statementId: string | number) => {
    // Normalisasi ID ke string untuk konsistensi
    const normalizedId = normalizeId(statementId);
    setSelectedIds((prev) =>
      prev.includes(normalizedId)
        ? prev.filter((id) => id !== normalizedId)
        : [...prev, normalizedId],
    );
  };

  const handleSelectAll = () => {
    // Dapatkan semua ID dari filteredStatements yang dinormalisasi
    const allFilteredIds = filteredStatements.map(s => normalizeId(s.id));
    
    // Cek apakah semua ID sudah terpilih
    const allSelected = allFilteredIds.every(id => selectedIds.includes(id));
    
    if (allSelected) {
      // Hapus semua ID dari filteredStatements
      setSelectedIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
      // Tambahkan semua ID yang belum ada
      const newIds = allFilteredIds.filter(id => !selectedIds.includes(id));
      setSelectedIds(prev => [...prev, ...newIds]);
    }
  };

  const handleFindAggregate = async () => {
    if (!onFindAggregate || selectedIds.length === 0) return;
    setIsFindingAggregate(true);
    try {
      const foundAggregate = await onFindAggregate(selectedIds);
      if (foundAggregate) {
        setLocalAggregate(foundAggregate);
        setMode("aggregate-first");
      } else {
        // Jika tidak ditemukan, tampilkan list aggregates untuk pemilihan manual
        setShowAggregateList(true);
        if (aggregates.length === 0 && onLoadAggregates) {
          await handleLoadAggregates();
        }
      }
    } finally {
      setIsFindingAggregate(false);
    }
  };

  const handleConfirm = async () => {
    if (!localAggregate) return;
    // Pastikan semua ID adalah string dengan menggunakan normalizeId
    const statementIds = selectedIds.map(id => normalizeId(id));
    await onConfirm(localAggregate.id, statementIds, overrideDifference);
    // Tutup modal setelah konfirmasi berhasil
    onClose();
  };

  if (!isOpen) return null;

  const isAggregateMode = mode === "aggregate-first";

  // Format currency helper
  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    });
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 flex max-w-full">
        <div className="w-screen max-w-4xl animate-in slide-in-from-right duration-300">
          <div className="flex h-full flex-col bg-white dark:bg-gray-900 shadow-2xl">
            {/* Header */}
            <div className="relative bg-linear-to-br from-indigo-600 to-violet-700 px-6 py-8">
              <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-violet-400/20 rounded-full blur-2xl" />

              <div className="relative flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Link2 className="w-6 h-6" />
                    Multi-Match Transaction
                  </h3>
                  <p className="text-indigo-100/80 mt-2 text-sm max-w-md leading-relaxed">
                    {isAggregateMode 
                      ? "Cocokkan 1 POS Aggregate dengan multiple Bank Statements"
                      : "Pilih Bank Statements untuk dicocokkan dengan POS Aggregate"}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-white/70" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-6">
                {/* Aggregate Selection dengan Manual Option */}
                <div className="bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800 rounded-2xl p-5">
                  <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    POS Aggregate
                  </h4>
                  
                  {/* Selected Aggregate Display */}
                  {localAggregate ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-indigo-100 dark:border-indigo-800">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Tanggal</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {localAggregate.transaction_date}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Payment Method</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {localAggregate.payment_method_name}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Ref</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {localAggregate.source_ref}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Nett Amount</p>
                          <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                            {localAggregate.nett_amount?.toLocaleString("id-ID", {
                              style: "currency",
                              currency: "IDR",
                              maximumFractionDigits: 0,
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        Belum ada aggregate yang dipilih
                      </p>
                    </div>
                  )}

                  {/* Aggregate Selection Dropdown */}
                  <div className="mt-4 relative">
                    <button
                      onClick={toggleAggregateList}
                      className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        {isLoadingAggregates ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Search className="w-4 h-4" />
                        )}
                        {localAggregate ? "Ubah Aggregate" : "Pilih Aggregate"}
                      </span>
                      {showAggregateList ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>

                    {/* Aggregate List Dropdown */}
                    {showAggregateList && (
                      <div className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-700 rounded-xl shadow-lg max-h-80 overflow-y-auto">
                        {/* Search Input */}
                        <div className="p-3 border-b border-gray-100 dark:border-gray-700">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              value={aggregateSearch}
                              onChange={(e) => setAggregateSearch(e.target.value)}
                              placeholder="Cari aggregate..."
                              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border-none rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>

                        {/* Aggregate Items */}
                        {filteredAggregates.length > 0 ? (
                          filteredAggregates.map((agg) => (
                            <button
                              key={agg.id}
                              onClick={() => handleSelectAggregate(agg)}
                              className={`w-full text-left px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${
                                localAggregate?.id === agg.id ? "bg-indigo-50 dark:bg-indigo-900/20" : ""
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                    {agg.source_ref}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {agg.payment_method_name} • {agg.transaction_date}
                                  </p>
                                </div>
                                <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 ml-4">
                                  {formatCurrency(agg.nett_amount)}
                                </p>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="p-4 text-center text-gray-500 text-sm">
                            {isLoadingAggregates ? (
                              <div className="flex items-center justify-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Memuat...
                              </div>
                            ) : aggregateSearch ? (
                              "Tidak ada aggregate yang cocok"
                            ) : (
                              "Tidak ada aggregate tersedia"
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* No Aggregate State & Find Button */}
                {!localAggregate && (
                  <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800 rounded-2xl p-5">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                          Pilih POS Aggregate
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                          {selectedIds.length} statements dipilih dengan total{" "}
                          <span className="font-bold">
                            {formatCurrency(totalSelected)}
                          </span>
                        </p>
                        {onFindAggregate && (
                          <button
                            onClick={handleFindAggregate}
                            disabled={isFindingAggregate || selectedIds.length === 0}
                            className="mt-3 flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-700 disabled:opacity-50 transition-colors"
                          >
                            {isFindingAggregate ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Search className="w-4 h-4" />
                            )}
                            Cari Aggregate Otomatis
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Bank Statements Selection */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <BankIcon className="w-4 h-4" />
                      {isAggregateMode ? "Select Bank Statements" : "Selected Bank Statements"}
                    </h4>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleSelectAll}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                      >
                        {isAllSelected ? "Deselect All" : "Select All"}
                      </button>
                      <span className="text-xs text-gray-500">{selectedIds.length} selected</span>
                    </div>
                  </div>

                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Cari statement..."
                      className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="max-h-64 overflow-y-auto border border-gray-100 dark:border-gray-800 rounded-xl">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-800/50 sticky top-0">
                        <tr>
                          <th className="w-10 px-3 py-2 text-left">
                            <input
                              type="checkbox"
                              checked={isAllSelected}
                              onChange={handleSelectAll}
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Tanggal</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Deskripsi</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {filteredStatements.map((statement) => {
                          const amount = (statement.credit_amount || 0) - (statement.debit_amount || 0);
                          // Gunakan normalizeId untuk konsistensi tipe data
                          const isSelected = selectedIds.includes(normalizeId(statement.id));
                          return (
                            <tr
                              key={normalizeId(statement.id)}
                              onClick={() => handleToggleStatement(statement.id)}
                              className={`cursor-pointer transition-colors ${
                                isSelected ? "bg-indigo-50 dark:bg-indigo-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                              }`}
                            >
                              <td className="px-3 py-2">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleStatement(statement.id)}
                                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                                {statement.transaction_date}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-900 dark:text-white max-w-xs truncate">
                                {statement.description || "-"}
                              </td>
                              <td className="px-3 py-2 text-sm font-medium text-right text-gray-900 dark:text-white">
                                {amount.toLocaleString("id-ID", { maximumFractionDigits: 0 })}
                              </td>
                            </tr>
                          );
                        })}
                        {filteredStatements.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-3 py-8 text-center text-gray-500">
                              {search ? "Tidak ada statement yang cocok dengan pencarian" : "Tidak ada statement tersedia"}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Summary & Validation */}
                {/* Conditional rendering yang aman - hanya tampilkan jika ada aggregate atau sedang mencari */}
                {(selectedIds.length > 0 && localAggregate) || 
                 (selectedIds.length > 0 && !localAggregate) ? (
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-5 space-y-4">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Ringkasan</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Statements Selected</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{selectedStatements.length} statements</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Total Selected Amount</p>
                        <p className="text-lg font-bold text-indigo-600">
                          {formatCurrency(totalSelected)}
                        </p>
                      </div>
                    </div>
                    {localAggregate && (
                      <>
                        <div className="h-px bg-gray-200 dark:bg-gray-700" />
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-500">Selisih</p>
                            <p className={`text-lg font-bold ${isWithinTolerance ? "text-green-600" : "text-red-600"}`}>
                              {formatCurrency(difference)} ({differencePercent.toFixed(2)}%)
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Target (Aggregate)</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">
                              {formatCurrency(aggregateAmount)}
                            </p>
                          </div>
                        </div>
                        {!isWithinTolerance && (
                          <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Selisih melebihi tolerance 5%</p>
                              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                                Centang "Override" jika Anda ingin tetap melanjutkan.
                              </p>
                              <label className="flex items-center gap-2 mt-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={overrideDifference}
                                  onChange={(e) => setOverrideDifference(e.target.checked)}
                                  className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                                />
                                <span className="text-sm font-medium text-amber-800 dark:text-amber-300">Override dan tetap lanjutkan</span>
                              </label>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/80 px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-all"
              >
                Batal
              </button>
              {localAggregate ? (
                <button
                  onClick={handleConfirm}
                  disabled={selectedIds.length === 0 || (!isWithinTolerance && !overrideDifference) || isLoading}
                  className="group px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                  Confirm Multi-Match
                </button>
              ) : (
                <button
                  onClick={handleFindAggregate}
                  disabled={isFindingAggregate || selectedIds.length === 0}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-all"
                >
                  {isFindingAggregate ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  Cari Aggregate
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

