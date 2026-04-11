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
import { tailwindTheme } from "@/lib/tailwind-theme";

// Helper function untuk normalisasi ID ke string
const normalizeId = (id: string | number): string => String(id);

// BankIcon component
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

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setOverrideDifference(false);
      setAggregateSearch("");
      setShowAggregateList(false);
      
      if (initialStatements.length > 0) {
        setMode("statements-first");
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

  // Calculate totals
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

  const isAllSelected = useMemo(() => {
    return filteredStatements.length > 0 && 
      filteredStatements.every(s => selectedIds.includes(normalizeId(s.id)));
  }, [filteredStatements, selectedIds]);

  const handleToggleStatement = (statementId: string | number) => {
    const normalizedId = normalizeId(statementId);
    setSelectedIds((prev) =>
      prev.includes(normalizedId)
        ? prev.filter((id) => id !== normalizedId)
        : [...prev, normalizedId],
    );
  };

  const handleSelectAll = () => {
    const allFilteredIds = filteredStatements.map(s => normalizeId(s.id));
    const allSelected = allFilteredIds.every(id => selectedIds.includes(id));
    
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
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
    const statementIds = selectedIds.map(id => normalizeId(id));
    await onConfirm(localAggregate.id, statementIds, overrideDifference);
    onClose();
  };

  if (!isOpen) return null;

  const isAggregateMode = mode === "aggregate-first";

  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    });
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-end">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative h-full w-full max-w-4xl animate-in slide-in-from-right duration-300">
        <div className="flex h-full flex-col bg-white dark:bg-gray-900 shadow-2xl">
          {/* Header */}
          <div className="relative bg-linear-to-br from-indigo-600 to-violet-700 px-6 py-8">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 rounded-full blur-3xl opacity-50" />
            <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-violet-400/20 rounded-full blur-2xl opacity-50" />

            <div className="relative flex items-start justify-between">
              <div>
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Link2 className="w-6 h-6" />
                  Multi-Match Transaction
                </h3>
                <p className="text-indigo-100/80 mt-2 text-sm max-w-md leading-relaxed font-medium">
                  {isAggregateMode 
                    ? "Cocokkan 1 POS Aggregate dengan multiple Bank Statements"
                    : "Pilih Bank Statements untuk dicocokkan dengan POS Aggregate"}
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
              {/* Aggregate Selection */}
              <div className={`${tailwindTheme.colors.accent.bg} ${tailwindTheme.colors.accent.border} border rounded-2xl p-5 shadow-sm`}>
                <h4 className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  POS Aggregate
                </h4>
                
                {localAggregate ? (
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-purple-100 dark:border-purple-800 shadow-sm">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-[10px] text-gray-500 font-bold uppercase">Tanggal</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          {localAggregate.transaction_date}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 font-bold uppercase">Metode</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          {localAggregate.payment_method_name}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 font-bold uppercase">Ref</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                          {localAggregate.source_ref}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 font-bold uppercase">Nett Amount</p>
                        <p className="text-lg font-extrabold text-purple-600 dark:text-purple-400">
                          {formatCurrency(localAggregate.nett_amount)}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 bg-white/50 dark:bg-black/20 rounded-xl border-2 border-dashed border-purple-200 dark:border-purple-800">
                    <p className="text-sm text-gray-500 font-medium italic">
                      Belum ada aggregate yang dipilih
                    </p>
                  </div>
                )}

                <div className="mt-4 relative">
                  <button
                    onClick={toggleAggregateList}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-700 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:border-purple-400 transition-all shadow-sm"
                  >
                    <span className="flex items-center gap-2">
                      {isLoadingAggregates ? (
                        <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                      ) : (
                        <Search className="w-4 h-4 text-purple-600" />
                      )}
                      {localAggregate ? "Ubah Aggregate" : "Pilih Aggregate Manual"}
                    </span>
                    {showAggregateList ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>

                  {showAggregateList && (
                    <div className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-800 border border-purple-100 dark:border-purple-800 rounded-xl shadow-xl max-h-80 overflow-y-auto animate-in slide-in-from-top-2 duration-300">
                      <div className="p-3 border-b border-gray-100 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={aggregateSearch}
                            onChange={(e) => setAggregateSearch(e.target.value)}
                            placeholder="Cari referensi atau nominal..."
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border-none rounded-lg text-sm focus:ring-2 focus:ring-purple-500 font-medium"
                          />
                        </div>
                      </div>

                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {filteredAggregates.length > 0 ? (
                          filteredAggregates.map((agg) => (
                            <button
                              key={agg.id}
                              onClick={() => handleSelectAggregate(agg)}
                              className={`w-full text-left px-4 py-3 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors ${
                                localAggregate?.id === agg.id ? "bg-purple-50 dark:bg-purple-900/40" : ""
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                    {agg.source_ref}
                                  </p>
                                  <p className="text-[10px] font-bold text-gray-400 uppercase">
                                    {agg.payment_method_name} • {agg.transaction_date}
                                  </p>
                                </div>
                                <p className="text-sm font-extrabold text-purple-600 dark:text-purple-400 ml-4">
                                  {formatCurrency(agg.nett_amount)}
                                </p>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="p-8 text-center text-gray-500 text-sm italic font-medium">
                            {isLoadingAggregates ? "Memuat data..." : "Tidak ditemukan"}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* No Aggregate State & Find Button */}
              {!localAggregate && selectedIds.length > 0 && (
                <div className={`${tailwindTheme.colors.warning.bg} ${tailwindTheme.colors.warning.border} border rounded-2xl p-5 shadow-sm`}>
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                      <AlertCircle className="w-5 h-5 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-orange-800 dark:text-orange-300">
                        Match POS Aggregate Otomatis
                      </p>
                      <p className="text-xs text-orange-700 dark:text-orange-400 mt-1 font-medium">
                        {selectedIds.length} statements dipilih dengan total <span className="font-extrabold">{formatCurrency(totalSelected)}</span>
                      </p>
                      {onFindAggregate && (
                        <button
                          onClick={handleFindAggregate}
                          disabled={isFindingAggregate}
                          className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-white rounded-xl text-xs font-bold hover:bg-orange-700 shadow-md shadow-orange-500/20 active:scale-95 transition-all"
                        >
                          {isFindingAggregate ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Search className="w-4 h-4" />
                          )}
                          CARI POS AGGREGATE
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Bank Statements Selection */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <BankIcon className="w-4 h-4" />
                    {isAggregateMode ? "Pilih Bank Statements" : "Statements Terpilih"}
                  </h4>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={handleSelectAll}
                      className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-tight hover:underline"
                    >
                      {isAllSelected ? "Deselect All" : "Select All"}
                    </button>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-md text-gray-500">
                      {selectedIds.length} TERPILIH
                    </span>
                  </div>
                </div>

                <div className="relative mb-4">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari deskripsi atau tanggal..."
                    className={tailwindTheme.components.input}
                  />
                </div>

                <div className="max-h-72 overflow-y-auto border border-gray-100 dark:border-gray-800 rounded-2xl shadow-inner scrollbar-thin">
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-50 dark:bg-gray-800/50 sticky top-0 z-10">
                      <tr>
                        <th className="w-12 px-4 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={isAllSelected}
                            onChange={handleSelectAll}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </th>
                        <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Tanggal</th>
                        <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Deskripsi</th>
                        <th className="px-3 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest">Nominal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {filteredStatements.map((statement) => {
                        const amount = (statement.credit_amount || 0) - (statement.debit_amount || 0);
                        const isSelected = selectedIds.includes(normalizeId(statement.id));
                        return (
                          <tr
                            key={normalizeId(statement.id)}
                            onClick={() => handleToggleStatement(statement.id)}
                            className={`cursor-pointer transition-all duration-200 group ${
                              isSelected ? "bg-blue-50/50 dark:bg-blue-900/10" : "hover:bg-gray-50 dark:hover:bg-gray-800/40"
                            }`}
                          >
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleStatement(statement.id)}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                            </td>
                            <td className="px-3 py-3 text-[11px] font-bold text-gray-500">
                              {statement.transaction_date}
                            </td>
                            <td className="px-3 py-3 text-sm font-medium text-gray-900 dark:text-gray-200 max-w-xs truncate group-hover:text-blue-600 transition-colors">
                              {statement.description || "-"}
                            </td>
                            <td className={`px-3 py-3 text-sm font-extrabold text-right ${amount > 0 ? 'text-green-600' : 'text-gray-900 dark:text-white'}`}>
                              {amount.toLocaleString("id-ID")}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredStatements.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center">
                            <AlertCircle className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                            <p className="text-sm font-medium text-gray-400 italic">Data tidak ditemukan</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary & Validation */}
              {selectedIds.length > 0 && (
                <div className={`${localAggregate ? (isWithinTolerance ? 'bg-green-50/50 dark:bg-green-900/10 border-green-100 dark:border-green-800' : 'bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-800') : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800'} border rounded-2xl p-6 space-y-5 transition-all duration-500`}>
                  <h4 className={`text-[10px] font-bold uppercase tracking-widest ${localAggregate ? (isWithinTolerance ? 'text-green-600' : 'text-red-600') : 'text-gray-400'}`}>Ringkasan Kecocokan</h4>
                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Items Selected</p>
                      <p className="text-xl font-extrabold text-gray-900 dark:text-white">{selectedStatements.length} unit</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Total Selected Amount</p>
                      <p className="text-2xl font-black text-blue-600 dark:text-blue-400">
                        {formatCurrency(totalSelected)}
                      </p>
                    </div>
                  </div>

                  {localAggregate && (
                    <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                      <div className="h-px bg-gray-200 dark:bg-gray-700 mb-5" />
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Selisih Nominal</p>
                          <p className={`text-xl font-black ${isWithinTolerance ? "text-green-600" : "text-red-600"}`}>
                            {formatCurrency(difference)} <span className="text-xs">({differencePercent.toFixed(2)}%)</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Target (Aggregate)</p>
                          <p className="text-xl font-extrabold text-gray-900 dark:text-white">
                            {formatCurrency(aggregateAmount)}
                          </p>
                        </div>
                      </div>

                      {!isWithinTolerance && (
                        <div className="mt-6 flex items-start gap-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl shadow-inner animate-pulse">
                          <AlertCircle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-bold text-orange-800 dark:text-orange-300 uppercase italic">⚠️ Tolerance Warning</p>
                            <p className="text-xs text-orange-700 dark:text-orange-400 mt-1 font-medium leading-relaxed">
                              Selisih nominal melebihi batas 5%. Centang konfirmasi manual untuk melanjutkan.
                            </p>
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
                              <span className="text-xs font-bold text-orange-800 dark:text-orange-300 group-hover:underline">Override & Proceed</span>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/80 px-6 py-5 flex items-center justify-end gap-4">
            <button onClick={onClose} className={tailwindTheme.components.secondaryButton}>
              Batal
            </button>
            {localAggregate ? (
              <button
                onClick={handleConfirm}
                disabled={selectedIds.length === 0 || (!isWithinTolerance && !overrideDifference) || isLoading}
                className={`${tailwindTheme.components.primaryButton} flex items-center gap-2 px-8 bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20`}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                Confirm Multi-Match
              </button>
            ) : (
              <button
                onClick={handleFindAggregate}
                disabled={isFindingAggregate || selectedIds.length === 0}
                className={`${tailwindTheme.components.primaryButton} flex items-center gap-2 px-8`}
              >
                {isFindingAggregate ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Cari Aggregate
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

