import React, { useState, useMemo, useCallback } from "react";
import {
  CheckCircle,
  AlertCircle,
  Undo2,
  HelpCircle,
  Sparkles,
  RefreshCw,
  Link2,
  Link2Off,
  CheckSquare,
  X,
  ChevronDown,
  ChevronUp,
  Info,
  Calendar,
  Check,
  Unlink2,
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
import { STATUS_CONFIG } from "../../constants/reconciliation.config";
import { Pagination } from "@/components/ui/Pagination";
import { tailwindTheme } from "@/lib/tailwind-theme";

// =============================================================================
// STATUS BADGE (Accessible: icon + color + label)
// =============================================================================

function StatusBadge({ status }: { status: BankReconciliationStatus }) {
  const config = STATUS_CONFIG[status];
  
  // Map internal status to theme pattern
  let themeVariant: keyof typeof tailwindTheme.components.statusBadge = 'unreconciled';
  if (status === 'AUTO_MATCHED') {
    themeVariant = 'matched';
  } else if (status === 'MANUALLY_MATCHED') {
    themeVariant = 'matched';
  } else if (status === 'DISCREPANCY') {
    themeVariant = 'discrepancy';
  } else if (status === 'PENDING') {
    themeVariant = 'pending';
  }

  const themeConfig = tailwindTheme.components.statusBadge[themeVariant];
  const iconMap: Record<BankReconciliationStatus, typeof CheckCircle> = {
    AUTO_MATCHED: CheckCircle,
    MANUALLY_MATCHED: CheckCircle,
    DISCREPANCY: AlertCircle,
    PENDING: HelpCircle,
    UNRECONCILED: AlertCircle,
  };
  const Icon = iconMap[status] || Info;

  return (
    <div
      className={themeConfig.container}
      role="status"
      aria-label={`Status: ${config.label}`}
    >
      <Icon className={themeConfig.icon} strokeWidth={3} aria-hidden="true" />
      <span className={themeConfig.text}>{config.label}</span>
    </div>
  );
}

// =============================================================================
// SKELETON LOADER
// =============================================================================

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={`skeleton-${i}`} className="border-b border-gray-100 dark:border-gray-800">
          <td className="px-6 py-6" colSpan={6}>
            <div className="flex items-center gap-4">
               <div className="h-12 w-12 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
               <div className="flex-1 space-y-3">
                  <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-1/4" />
                  <div className="h-3 bg-gray-50 dark:bg-gray-800/50 rounded animate-pulse w-1/2" />
               </div>
               <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-24" />
               <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse w-24" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

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
  isTableLoading?: boolean;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  onOpenWizard?: () => void;
  onUndoGroup?: (groupId: string) => Promise<void>;
}

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
  isTableLoading = false,
  pagination,
  onPageChange,
  onLimitChange,
  onOpenWizard,
  onUndoGroup,
}: BankMutationTableProps) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedStatementIds, setSelectedStatementIds] = useState<string[]>([]);
  const [showEmptySelectionWarning, setShowEmptySelectionWarning] = useState(false);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  // Map statement ID → group for O(1) lookup
  const statementGroupMap = useMemo(() => {
    const map: Record<string, ReconciliationGroup> = {};
    reconciliationGroups.forEach((group) => {
      group.details?.forEach((detail) => {
        map[detail.statement_id] = group;
      });
    });
    return map;
  }, [reconciliationGroups]);

  const selectedTotal = useMemo(() => {
    return calculateSelectedTotal(items, selectedStatementIds);
  }, [items, selectedStatementIds]);

  const calculateDifference = useCallback((item: BankStatementWithMatch) => {
    if (!item.is_reconciled || !item.matched_aggregate) return 0;
    const bankAmount = getNetAmount(item.credit_amount, item.debit_amount);
    return Math.abs(bankAmount - item.matched_aggregate.nett_amount);
  }, []);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      if (!prev) setSelectedStatementIds([]);
      return !prev;
    });
  }, []);

  const handleRowSelect = useCallback((statementId: string, checked: boolean) => {
    setSelectedStatementIds((prev) =>
      checked ? [...prev, statementId] : prev.filter((id) => id !== statementId)
    );
    setShowEmptySelectionWarning(false);
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedStatementIds.length === items.length && items.length > 0) {
      setSelectedStatementIds([]);
    } else {
      setSelectedStatementIds(items.map((item) => item.id));
    }
    setShowEmptySelectionWarning(false);
  }, [items, selectedStatementIds.length]);

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

  const colCount = selectionMode ? 6 : 5;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm transition-all duration-300">
      {/* Multi-Match Selection Bar */}
      {selectionMode && (
        <div className="bg-linear-to-r from-blue-600 to-indigo-700 px-6 py-4 animate-in slide-in-from-top duration-300">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6">
              <button
                onClick={handleSelectAll}
                className="group relative flex items-center justify-center transition-transform active:scale-90"
                aria-label={selectedStatementIds.length === items.length ? "Hapus semua pilihan" : "Pilih semua"}
              >
                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center bg-white/10 ${selectedStatementIds.length === items.length ? 'border-white' : 'border-white/40 group-hover:border-white'}`}>
                  {selectedStatementIds.length === items.length && items.length > 0 && (
                    <CheckSquare className="w-4 h-4 text-white" />
                  )}
                </div>
              </button>
              <div>
                 <span className="text-white text-sm font-black uppercase tracking-widest">
                   {selectedStatementIds.length} Statements Selected
                 </span>
                 <p className="text-blue-100 text-[10px] font-bold uppercase tracking-tight mt-0.5">
                    Click "Multi-Match" to reconcile as group
                 </p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-blue-200 text-[10px] font-bold uppercase tracking-widest leading-none mb-1">Total Selected</p>
                <p className="text-lg font-black text-white leading-none">
                  {formatCurrency(selectedTotal)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleMultiMatchClick}
                  disabled={selectedStatementIds.length === 0 || !onMultiMatch}
                  className="flex items-center gap-2 px-6 py-2.5 bg-white text-blue-700 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg active:scale-95"
                >
                  <Link2 className="w-4 h-4" />
                  Multi-Match
                </button>
                <button
                  onClick={toggleSelectionMode}
                  className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl border border-white/20 transition-all active:scale-90"
                  aria-label="Tutup mode seleksi"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          </div>

          {showEmptySelectionWarning && (
            <div className="mt-3 flex items-center gap-3 text-xs font-bold text-white bg-red-500/30 px-4 py-2 rounded-xl animate-in slide-in-from-top-2 border border-red-400/30">
              <AlertCircle className="w-4 h-4" />
              Pilih minimal satu statement terlebih dahulu
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div className="px-6 py-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-wrap gap-4 bg-gray-50/20 dark:bg-gray-800/20">
        <div>
          <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/40 rounded-xl">
               <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            Mutasi Bank
          </h3>
          <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tight mt-1 ml-11">
            {items.length} transaksi · <span className="text-green-600 dark:text-green-400">{items.filter(i => i.is_reconciled).length} cocok</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {showMultiMatch && onMultiMatch && !selectionMode && (
            <button
              onClick={toggleSelectionMode}
              className="flex items-center gap-2.5 px-5 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 transition-all group active:scale-95 border border-transparent hover:border-blue-500 shadow-xs"
            >
              <Link2Off className="w-4 h-4 group-hover:rotate-12 transition-transform" />
              Multi-Match Selection
            </button>
          )}
          {onOpenWizard && !selectionMode && (
            <button
              onClick={onOpenWizard}
              className="group relative flex items-center gap-2.5 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 shadow-md shadow-blue-500/20 active:scale-95 transition-all overflow-hidden"
            >
              <Sparkles className="w-4 h-4 group-hover:scale-125 transition-transform" />
              Wizard
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full border-collapse" role="table">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-gray-900/50 font-black text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              {selectionMode && (
                <th className="w-16 px-6 py-4 text-center" scope="col">
                  <button
                    onClick={handleSelectAll}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${selectedStatementIds.length === items.length && items.length > 0 ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                      {selectedStatementIds.length === items.length && items.length > 0 && (
                        <CheckSquare className="w-3.5 h-3.5 text-white" />
                      )}
                    </div>
                  </button>
                </th>
              )}
              <th className="px-6 py-4 text-left" scope="col">Transaksi & Status</th>
              <th className="px-6 py-4 text-right" scope="col">Nominal Bank</th>
              <th className="px-6 py-4 text-right hidden md:table-cell" scope="col">Nett POS</th>
              <th className="px-6 py-4 text-right hidden lg:table-cell" scope="col">Selisih</th>
              <th className="px-6 py-4 text-right" scope="col">Tindakan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {isTableLoading ? (
              <TableSkeleton rows={10} />
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-6 py-24 text-center">
                  <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-6 opacity-40">
                    <CheckCircle className="w-10 h-10 text-gray-300" />
                  </div>
                  <h4 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-widest">Tidak ada mutasi</h4>
                  <p className="text-sm text-gray-400 mt-2">Filter rentang tanggal atau akun bank untuk memuat data.</p>
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const isSelected = selectedStatementIds.includes(item.id);
                const groupInfo = statementGroupMap[item.id];
                const isInGroup = !!groupInfo;
                const hasPotentialMatch = (potentialMatchesMap[item.id]?.length ?? 0) > 0;
                const potentialMatch = potentialMatchesMap[item.id]?.[0];
                const netAmount = getNetAmount(item.credit_amount, item.debit_amount);
                const isGroupExpanded = isInGroup && expandedGroupId === groupInfo.id;

                return (
                  <React.Fragment key={item.id}>
                    <tr
                      className={`
                        transition-all duration-200 group/row
                        ${isSelected ? "bg-blue-50/50 dark:bg-blue-900/10" : "hover:bg-gray-50/30 dark:hover:bg-gray-800/20"}
                        ${isInGroup ? "border-l-4 border-l-blue-600" : ""}
                      `}
                    >
                      {selectionMode && (
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleRowSelect(item.id, !isSelected)}
                            disabled={isInGroup}
                            className="transition-all active:scale-90"
                          >
                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 border-blue-600 shadow-sm' : 'border-gray-200 dark:border-gray-700'}`}>
                               {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={4} />}
                            </div>
                          </button>
                        </td>
                      )}

                      {/* Transaksi & Status */}
                      <td className="px-6 py-5">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 text-gray-400">
                               <Calendar className="w-3.5 h-3.5" />
                               <span className="text-[11px] font-black uppercase tracking-tight">
                                 {formatDate(item.transaction_date)}
                               </span>
                            </div>
                            {isInGroup && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 rounded-md text-[9px] font-black uppercase tracking-widest shadow-xs">
                                <Link2 className="w-3 h-3" strokeWidth={3} />
                                Grouped
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-black text-gray-900 dark:text-white max-w-[500px] leading-tight group-hover/row:text-blue-600 transition-colors" title={item.description}>
                            {item.description ?? "Untitled Transaction"}
                          </p>
                          <StatusBadge status={item.status} />
                        </div>
                      </td>

                      {/* Nominal Bank */}
                      <td className="px-6 py-5 text-right">
                        <div className="flex flex-col items-end">
                           <span className={`text-[11px] font-black uppercase mb-1 ${netAmount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                             {netAmount >= 0 ? 'Kredit +' : 'Debit -'}
                           </span>
                           <span className="text-base font-black text-gray-900 dark:text-white">
                             {formatNumber(Math.abs(netAmount))}
                           </span>
                        </div>
                      </td>

                      {/* POS Match (Aggregate) */}
                      <td className="px-6 py-5 text-right hidden md:table-cell">
                        <div className="flex flex-col items-end">
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">POS Aggregate</span>
                          <span className="text-base font-black text-gray-700 dark:text-gray-300">
                            {item.matched_aggregate
                              ? formatNumber(item.matched_aggregate.nett_amount)
                              : "—"}
                          </span>
                        </div>
                      </td>

                      {/* Selisih */}
                      <td className="px-6 py-5 text-right hidden lg:table-cell">
                        {calculateDifference(item) > 0 ? (
                          <div className="flex flex-col items-end">
                             <span className="text-[9px] font-black text-red-400 dark:text-red-500 uppercase tracking-widest mb-1">Difference</span>
                             <span className="text-base font-black text-red-600 dark:text-red-400">
                               {formatNumber(calculateDifference(item))}
                             </span>
                          </div>
                        ) : (
                          <span className="text-gray-200 dark:text-gray-800 font-black">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          {!item.is_reconciled && !isInGroup && (
                            <>
                              {hasPotentialMatch ? (
                                <div className="flex items-center gap-2 group/match animate-in fade-in slide-in-from-right duration-300">
                                  <div className="hidden xl:flex flex-col items-end px-3 py-1 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-xl shadow-xs">
                                    <div className="flex items-center gap-1.5">
                                       <Sparkles className="w-3 h-3 text-blue-600 dark:text-blue-400 animate-pulse" />
                                       <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-tighter">Suggest</span>
                                    </div>
                                    <span className="text-[11px] font-black text-gray-900 dark:text-white leading-tight">
                                       {formatNumber(potentialMatch?.nett_amount ?? 0)}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => potentialMatch?.id && onQuickMatch(item, potentialMatch.id)}
                                    className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 shadow-md shadow-blue-500/20 active:scale-95 transition-all"
                                    aria-label={`Match dengan ${potentialMatch?.payment_method_name}`}
                                  >
                                    Match
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => onCheckMatches?.(item.id)}
                                  disabled={isLoadingMatches[item.id]}
                                  className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-50 dark:hover:bg-blue-950 transition-all flex items-center gap-2"
                                  aria-label={`Suggest matches for ${item.description}`}
                                >
                                  {isLoadingMatches[item.id] ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Sparkles className="w-3.5 h-3.5" />
                                  )}
                                  Suggest
                                </button>
                              )}
                              <button
                                onClick={() => onManualMatch(item)}
                                className="px-4 py-2.5 bg-gray-900 dark:bg-white dark:text-gray-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:shadow-lg transition-all active:scale-95"
                                aria-label="Manual match"
                              >
                                Manual
                              </button>
                            </>
                          )}

                          {item.is_reconciled && !isInGroup && (
                            <button
                              onClick={() => onUndo(item.id)}
                              className="px-5 py-2.5 bg-white dark:bg-gray-800 text-gray-500 hover:text-red-600 border border-gray-100 dark:border-gray-800 rounded-xl text-xs font-black uppercase tracking-widest hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-950 transition-all flex items-center gap-2"
                              aria-label="Undo reconciliation"
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                              Undo Match
                            </button>
                          )}

                          {isInGroup && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setExpandedGroupId(isGroupExpanded ? null : groupInfo.id)}
                                className={`
                                  flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm
                                  ${isGroupExpanded 
                                    ? "bg-blue-600 text-white" 
                                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-950"}
                                `}
                                aria-expanded={isGroupExpanded}
                              >
                                {isGroupExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                Group
                              </button>
                              {onUndoGroup && (
                                <button
                                  onClick={() => {
                                    if (confirm('Batalkan seluruh multi-match group ini?')) {
                                      onUndoGroup(groupInfo.id);
                                    }
                                  }}
                                  className="flex items-center gap-1.5 px-4 py-2.5 bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-950 hover:border-red-400 transition-all"
                                  aria-label="Revert group match"
                                >
                                  <Unlink2 className="w-3.5 h-3.5" />
                                  Revert
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Group Detail Row */}
                    {isGroupExpanded && groupInfo && (
                      <tr className="bg-blue-50/20 dark:bg-blue-900/5 animate-in slide-in-from-top duration-300">
                        <td colSpan={colCount} className="p-0">
                          <div className="px-10 py-8 space-y-8 bg-linear-to-b from-gray-50/50 to-white dark:from-gray-800/20 dark:to-gray-900 border-x-4 border-blue-600">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-3">
                                <Link2 className="w-4 h-4 text-blue-600" />
                                Reconciliation Group Profile
                              </h4>
                              <div className="px-4 py-1.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 shadow-xs">
                                <span className="text-[10px] font-black text-gray-500 uppercase">{groupInfo.details?.length ?? 0} Statements Unified</span>
                              </div>
                            </div>

                            {groupInfo.aggregate && (
                              <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 dark:bg-blue-900/20 rounded-full blur-3xl -mr-16 -mt-16 opacity-50" />
                                <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-6">Target POS Aggregate</p>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                                  <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Transaction Date</p>
                                    <p className="text-sm font-black text-gray-900 dark:text-white">
                                      {formatDate(groupInfo.aggregate.transaction_date)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Collection Method</p>
                                    <p className="text-sm font-black text-gray-900 dark:text-white">
                                      {groupInfo.aggregate.payment_method_name}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Nett POS Total</p>
                                    <p className="text-lg font-black text-blue-700 dark:text-blue-400">
                                      {formatCurrency(groupInfo.aggregate.nett_amount)}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Net Difference</p>
                                    <div className={`text-lg font-black ${groupInfo.difference === 0 ? 'text-green-600' : 'text-orange-600'}`}>
                                      {formatCurrency(groupInfo.difference)}
                                      {groupInfo.difference === 0 && <CheckCircle className="inline-block ml-2 w-4 h-4" />}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Group Statement List */}
                            {groupInfo.details && groupInfo.details.length > 0 && (
                              <div className="space-y-4">
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                  <div className="w-4 h-px bg-gray-300" />
                                  Bank Statements in Group
                                </p>
                                <div className="grid grid-cols-1 gap-2">
                                  {groupInfo.details.map((detail) => {
                                    const credit = detail.statement?.credit_amount ?? 0;
                                    const debit = detail.statement?.debit_amount ?? 0;
                                    const amt = credit - debit;
                                    return (
                                      <div key={detail.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-blue-200 transition-all shadow-xs group/dt">
                                        <div className="flex-1 min-w-0 flex items-center gap-4">
                                          <div className="w-1.5 h-10 bg-gray-50 dark:bg-gray-700 group-hover/dt:bg-blue-500 rounded-full transition-colors" />
                                          <div>
                                            <span className="text-[10px] font-black text-gray-400 uppercase mb-0.5 block">
                                              {formatDate(detail.statement?.transaction_date)}
                                            </span>
                                            <span className="text-sm font-semibold text-gray-900 dark:text-white lg:max-w-xl block">
                                              {detail.statement?.description || "Historical Statement Record"}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="flex flex-col items-end">
                                           <span className={`text-sm font-black ${amt >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                             {formatCurrency(amt)}
                                           </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && (pagination.totalPages > 0 || pagination.total > 0) && (
        <div className="bg-gray-50/50 dark:bg-gray-800/30 p-4 border-t border-gray-100 dark:border-gray-800">
           <Pagination
             pagination={{
               page: pagination.page,
               limit: pagination.limit,
               total: pagination.total,
               totalPages: pagination.totalPages,
               hasNext: pagination.hasNext,
               hasPrev: pagination.hasPrev,
             }}
             onPageChange={onPageChange}
             onLimitChange={onLimitChange}
             currentLength={items.length}
           />
        </div>
      )}
    </div>
  );
}
