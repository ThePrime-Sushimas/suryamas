import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Search,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Undo2,
  HelpCircle,
  Sparkles,
  RefreshCw,
  Link2,
  Link2Off,
  Square,
  CheckSquare,
  X,
  Eye,
  EyeOff,
  Info,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type {
  BankStatementWithMatch,
  BankReconciliationStatus,
  PotentialMatch,
  ReconciliationGroup,
} from "../../types/bank-reconciliation.types";
import {
  formatDate,
  formatCurrency,
  formatNumber,
  calculateSelectedTotal,
  getNetAmount,
} from "../../utils/reconciliation.utils";
import {
  STORAGE_KEYS,
  STATUS_CONFIG,
} from "../../constants/reconciliation.config";

// =============================================================================
// TYPES
// =============================================================================

interface BankMutationTableProps {
  items: BankStatementWithMatch[];
  potentialMatchesMap?: Record<string, PotentialMatch[]>;
  isLoadingMatches?: Record<string, boolean>;
  onManualMatch: (item: BankStatementWithMatch) => void;
  onQuickMatch: (item: BankStatementWithMatch, aggregateId: string) => void;
  onCheckMatches?: (statementId: string) => void;
  onUndo: (statementId: string) => void;
  onMultiMatch?: (items: BankStatementWithMatch[]) => void;
  reconciliationGroups?: ReconciliationGroup[];
  showMultiMatch?: boolean;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  onPageChange?: (page: number) => void;
}

type TableFilter = "ALL" | "UNRECONCILED" | "RECONCILED" | "DISCREPANCY";

// =============================================================================
// COMPONENT
// =============================================================================

export function BankMutationTable({
  items,
  potentialMatchesMap = {},
  isLoadingMatches = {},
  onManualMatch,
  onQuickMatch,
  onCheckMatches,
  onUndo,
  onMultiMatch,
  reconciliationGroups = [],
  showMultiMatch = true,
  pagination,
  onPageChange,
}: BankMutationTableProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TableFilter>("ALL");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedStatementIds, setSelectedStatementIds] = useState<string[]>([]);
  const [showEmptySelectionWarning, setShowEmptySelectionWarning] = useState(false);

  // Toggle hide debit column - persisted in localStorage
  const [hideDebit, setHideDebit] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEYS.HIDE_DEBIT_COLUMN);
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.HIDE_DEBIT_COLUMN, String(hideDebit));
  }, [hideDebit]);

  // Build a map of statement ID -> group info - memoized for O(1) lookup
  const statementGroupMap = useMemo(() => {
    const map: Record<string, ReconciliationGroup> = {};
    reconciliationGroups.forEach((group) => {
      group.details?.forEach((detail) => {
        map[detail.statement_id] = group;
      });
    });
    return map;
  }, [reconciliationGroups]);

  // Filter items with proper memoization
  const filteredItems = useMemo(() => {
    const searchLower = search.toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        item.description?.toLowerCase().includes(searchLower) ||
        item.reference_number?.toLowerCase().includes(searchLower);

      switch (filter) {
        case "UNRECONCILED":
          return matchesSearch && !item.is_reconciled && item.status !== "DISCREPANCY";
        case "RECONCILED":
          return matchesSearch && item.is_reconciled;
        case "DISCREPANCY":
          return matchesSearch && item.status === "DISCREPANCY";
        default:
          return matchesSearch;
      }
    });
  }, [items, search, filter]);

  // Memoized total calculation using O(1) lookup
  const selectedTotal = useMemo(() => {
    return calculateSelectedTotal(items, selectedStatementIds);
  }, [items, selectedStatementIds]);

  // Get status badge with proper configuration
  const getStatusBadge = useCallback((status: BankReconciliationStatus) => {
    const config = STATUS_CONFIG[status];
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${config.bg} ${config.color}`}>
        {status === "AUTO_MATCHED" || status === "MANUALLY_MATCHED" ? (
          <CheckCircle className="w-3 h-3" />
        ) : status === "DISCREPANCY" ? (
          <AlertCircle className="w-3 h-3" />
        ) : (
          <HelpCircle className="w-3 h-3" />
        )}
        {config.label}
      </div>
    );
  }, []);

  // Calculate difference using nullish coalescing
  const calculateDifference = useCallback((item: BankStatementWithMatch) => {
    if (!item.is_reconciled || !item.matched_aggregate) return 0;
    const bankAmount = getNetAmount(item.credit_amount, item.debit_amount);
    return Math.abs(bankAmount - item.matched_aggregate.nett_amount);
  }, []);

  // Toggle selection mode
  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      const newMode = !prev;
      if (!newMode) {
        setSelectedStatementIds([]);
      }
      return newMode;
    });
  }, []);

  // Handle row selection
  const handleRowSelect = useCallback((statementId: string, checked: boolean) => {
    setSelectedStatementIds((prev) =>
      checked ? [...prev, statementId] : prev.filter((id) => id !== statementId)
    );
    setShowEmptySelectionWarning(false);
  }, []);

  // Handle select all
  const handleSelectAll = useCallback(() => {
    if (selectedStatementIds.length === filteredItems.length) {
      setSelectedStatementIds([]);
    } else {
      setSelectedStatementIds(filteredItems.map((item) => item.id));
    }
    setShowEmptySelectionWarning(false);
  }, [filteredItems, selectedStatementIds.length]);

  // Handle clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedStatementIds([]);
  }, []);

  // Handle multi-match click with validation
  const handleMultiMatchClick = useCallback(() => {
    if (selectedStatementIds.length === 0) {
      setShowEmptySelectionWarning(true);
      return;
    }
    if (onMultiMatch) {
      const selectedItems = items.filter((item) =>
        selectedStatementIds.includes(item.id)
      );
      onMultiMatch(selectedItems);
    }
  }, [selectedStatementIds, items, onMultiMatch]);

  // Calculate colspan based on visible columns
  const getColspan = useCallback(() => {
    let cols = 6;
    if (selectionMode) cols += 1;
    if (!hideDebit) cols += 1;
    return cols;
  }, [selectionMode, hideDebit]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
      {/* Multi-Match Selection Bar */}
      {selectionMode && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800 px-5 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAll}
                  className="p-1 hover:bg-indigo-100 dark:hover:bg-indigo-800 rounded transition-colors"
                >
                  {selectedStatementIds.length === filteredItems.length &&
                  filteredItems.length > 0 ? (
                    <CheckSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  ) : (
                    <Square className="w-5 h-5 text-indigo-400" />
                  )}
                </button>
                <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                  {selectedStatementIds.length} selected
                </span>
              </div>
              <button
                onClick={handleClearSelection}
                className="text-xs text-indigo-500 hover:text-indigo-700 dark:text-indigo-400"
              >
                Clear
              </button>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-sm">
                <span className="text-indigo-600 dark:text-indigo-400">Total: </span>
                <span className="font-bold text-indigo-700 dark:text-indigo-300">
                  {formatCurrency(selectedTotal)}
                </span>
              </div>

              <button
                onClick={handleMultiMatchClick}
                disabled={selectedStatementIds.length === 0 || !onMultiMatch}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20"
              >
                <Link2 className="w-4 h-4" />
                Multi-Match ({selectedStatementIds.length})
              </button>

              <button
                onClick={toggleSelectionMode}
                className="p-2 hover:bg-indigo-100 dark:hover:bg-indigo-800 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-indigo-500" />
              </button>
            </div>
          </div>

          {/* Empty Selection Warning */}
          {showEmptySelectionWarning && (
            <div className="mt-3 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg animate-in slide-in-from-top-2">
              <Info className="w-4 h-4" />
              Silakan pilih minimal satu statement terlebih dahulu
            </div>
          )}
        </div>
      )}

      {/* Header */}
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
          {/* Toggle Hide Debit Button */}
          <button
            onClick={() => setHideDebit(!hideDebit)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
              hideDebit
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                : "bg-gray-50 text-gray-600 dark:bg-gray-900 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
            title={hideDebit ? "Tampilkan kolom Debit" : "Sembunyikan kolom Debit"}
          >
            {hideDebit ? (
              <>
                <EyeOff className="w-4 h-4" />
                <span className="hidden sm:inline">Debit</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                <span className="hidden sm:inline">Debit</span>
              </>
            )}
          </button>

          {showMultiMatch && onMultiMatch && (
            <button
              onClick={toggleSelectionMode}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                selectionMode
                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                  : "bg-gray-50 text-gray-600 dark:bg-gray-900 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <Link2Off className="w-4 h-4" />
              <span className="hidden sm:inline">Select for Multi-Match</span>
            </button>
          )}

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
            onChange={(e) => setFilter(e.target.value as TableFilter)}
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
              {selectionMode && (
                <th className="w-12 px-4 py-4 text-center">
                  <button
                    onClick={handleSelectAll}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                  >
                    {selectedStatementIds.length === filteredItems.length &&
                    filteredItems.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </th>
              )}
              <th className="px-6 py-4">Tanggal & Deskripsi</th>
              {!hideDebit && <th className="px-6 py-4 text-right">Debit</th>}
              <th className="px-6 py-4 text-right">Kredit</th>
              <th className="px-6 py-4 text-right">POS Match</th>
              <th className="px-6 py-4 text-right">Selisih</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredItems.map((item) => {
              const isSelected = selectedStatementIds.includes(item.id);
              const groupInfo = statementGroupMap[item.id];
              const isInGroup = !!groupInfo;
              const hasPotentialMatch = (potentialMatchesMap[item.id]?.length ?? 0) > 0;
              const potentialMatch = potentialMatchesMap[item.id]?.[0];

              return (
                <tr
                  key={item.id}
                  className={`
                    transition-colors
                    ${isSelected ? "bg-indigo-50/50 dark:bg-indigo-900/20" : "hover:bg-gray-50/50 dark:hover:bg-gray-900/30"}
                    ${isInGroup ? "opacity-60" : ""}
                  `}
                >
                  {selectionMode && (
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => handleRowSelect(item.id, !isSelected)}
                        disabled={isInGroup}
                        className="p-1 hover:bg-indigo-100 dark:hover:bg-indigo-800 rounded transition-colors disabled:opacity-30"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </td>
                  )}
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatDate(item.transaction_date)}
                        </span>
                        {isInGroup && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded text-[10px] font-bold">
                            <Link2 className="w-3 h-3" />
                            Grouped
                          </span>
                        )}
                      </div>
                      <span
                        className="text-xs text-gray-500 max-w-[400px]"
                        title={item.description}
                      >
                        {item.description ?? "No description"}
                      </span>
                    </div>
                  </td>
                  {!hideDebit && (
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-medium text-rose-600">
                        {item.debit_amount > 0 ? formatNumber(item.debit_amount) : "-"}
                      </span>
                    </td>
                  )}
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-medium text-green-600">
                      {item.credit_amount > 0 ? formatNumber(item.credit_amount) : "-"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                      {item.matched_aggregate
                        ? formatNumber(item.matched_aggregate.nett_amount)
                        : "-"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span
                      className={`text-sm font-bold ${calculateDifference(item) === 0 ? "text-gray-400" : "text-rose-600"}`}
                    >
                      {calculateDifference(item) > 0 ? formatNumber(calculateDifference(item)) : "-"}
                    </span>
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(item.status)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 group-hover/row:opacity-100 transition-opacity">
                      {!item.is_reconciled && !isInGroup && (
                        <>
                          {hasPotentialMatch ? (
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold shadow-sm">
                                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                                {formatNumber(potentialMatch?.nett_amount ?? 0)}
                              </div>
                              <button
                                onClick={() => {
                                  if (potentialMatch?.id) {
                                    onQuickMatch(item, potentialMatch.id);
                                  }
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm"
                                title={`Cocokkan dengan ${potentialMatch?.payment_method_name ?? 'Payment Gateway'}${potentialMatch?.branch_name ? ` (${potentialMatch.branch_name})` : ''} ${formatCurrency(potentialMatch?.nett_amount ?? 0)}`}
                              >
                                Match
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => onCheckMatches?.(item.id)}
                              disabled={isLoadingMatches[item.id]}
                              className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all disabled:opacity-50"
                            >
                              {isLoadingMatches[item.id] ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Sparkles className="w-3.5 h-3.5" />
                              )}
                              Suggest
                            </button>
                          )}
                        </>
                      )}
                      {item.is_reconciled && !isInGroup && (
                        <button
                          onClick={() => onUndo(item.id)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                          Revert
                        </button>
                      )}
                      {!item.is_reconciled && !isInGroup && (
                        <button
                          onClick={() => onManualMatch(item)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 shadow-sm hover:shadow-blue-500/20 transition-all"
                        >
                          Match
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {isInGroup && (
                        <span className="text-xs text-indigo-500 dark:text-indigo-400 font-medium">
                          In Group
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredItems.length === 0 && (
              <tr>
                <td
                  colSpan={getColspan()}
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

      {/* Pagination */}
      {pagination && (pagination.totalPages > 0 || pagination.total > 0) && (
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
          <div className="flex items-center justify-between">
            {/* Info */}
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Menampilkan <span className="font-medium">{items.length}</span> dari{' '}
              <span className="font-medium">{pagination.total}</span> data
            </div>
            
            {/* Pagination Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onPageChange?.(pagination.page - 1)}
                disabled={!pagination.hasPrev}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              
              <span className="text-sm text-gray-600 dark:text-gray-400 px-2">
                Halaman <span className="font-medium">{pagination.page}</span>{' '}
                {pagination.totalPages > 0 ? (
                  <>dari <span className="font-medium">{pagination.totalPages}</span></>
                ) : (
                  ''
                )}
              </span>
              
              <button
                onClick={() => onPageChange?.(pagination.page + 1)}
                disabled={!pagination.hasNext}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

