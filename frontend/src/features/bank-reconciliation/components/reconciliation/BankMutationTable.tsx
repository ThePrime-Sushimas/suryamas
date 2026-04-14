import React, { useState, useMemo, useCallback } from "react";
import {
  CheckCircle,
  AlertCircle,
  Undo2,
  HelpCircle,
  Sparkles,
  RefreshCw,
  Link2,
  ChevronDown,
  ChevronUp,
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
  getNetAmount,
} from "../../utils/reconciliation.utils";
import { STATUS_CONFIG } from "../../constants/reconciliation.config";
import { Pagination } from "@/components/ui/Pagination";

function StatusBadge({ status }: { status: BankReconciliationStatus }) {
  const config = STATUS_CONFIG[status];
  const colors: Record<BankReconciliationStatus, string> = {
    AUTO_MATCHED: "text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/20",
    MANUALLY_MATCHED: "text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/20",
    DISCREPANCY: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20",
    PENDING: "text-blue-700 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20",
    UNRECONCILED: "text-gray-500 bg-gray-50 dark:text-gray-400 dark:bg-gray-800",
  };
  const icons: Record<BankReconciliationStatus, typeof CheckCircle> = {
    AUTO_MATCHED: CheckCircle,
    MANUALLY_MATCHED: CheckCircle,
    DISCREPANCY: AlertCircle,
    PENDING: HelpCircle,
    UNRECONCILED: AlertCircle,
  };
  const Icon = icons[status];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[status]}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={`skeleton-${i}`} className="border-b border-gray-100 dark:border-gray-800">
          <td className="px-3 py-2.5" colSpan={7}>
            <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-full" />
          </td>
        </tr>
      ))}
    </>
  );
}

interface BankMutationTableProps {
  items: BankStatementWithMatch[];
  potentialMatchesMap?: Record<string, PotentialMatch[]>;
  isLoadingMatches?: Record<string, boolean>;
  onManualMatch: (item: BankStatementWithMatch) => void;
  onQuickMatch: (item: BankStatementWithMatch, aggregateId: string) => void;
  onCheckMatches?: (statementId: string) => void;
  onUndo: (statementId: string) => void;
  reconciliationGroups?: ReconciliationGroup[];
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
  onUndoGroup?: (groupId: string) => Promise<void>;
}

export function BankMutationTable({
  items,
  potentialMatchesMap = {},
  isLoadingMatches = {},
  onManualMatch,
  onQuickMatch,
  onCheckMatches,
  onUndo,
  reconciliationGroups = [],
  isTableLoading = false,
  pagination,
  onPageChange,
  onLimitChange,
  onUndoGroup,
}: BankMutationTableProps) {
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  const statementGroupMap = useMemo(() => {
    const map: Record<string, ReconciliationGroup> = {};
    reconciliationGroups.forEach((group) => {
      group.details?.forEach((detail) => {
        map[detail.statement_id] = group;
      });
    });
    return map;
  }, [reconciliationGroups]);

  const calculateDifference = useCallback((item: BankStatementWithMatch) => {
    if (!item.is_reconciled || !item.matched_aggregate) return 0;
    const bankAmount = getNetAmount(item.credit_amount, item.debit_amount);
    return Math.abs(bankAmount - item.matched_aggregate.nett_amount);
  }, []);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Mutasi Bank</h3>
          <span className="text-xs text-gray-500">
            {items.length} transaksi · <span className="text-green-600">{items.filter(i => i.is_reconciled).length} cocok</span>
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50 text-[11px] text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="px-3 py-2 text-left font-medium">Tanggal</th>
              <th className="px-3 py-2 text-left font-medium">Keterangan</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">Debit</th>
              <th className="px-3 py-2 text-right font-medium">Kredit</th>
              <th className="px-3 py-2 text-right font-medium">Nett POS</th>
              <th className="px-3 py-2 text-right font-medium">Selisih</th>
              <th className="px-3 py-2 text-center font-medium w-28"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {isTableLoading ? (
              <TableSkeleton rows={10} />
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-12 text-center text-gray-400 text-sm">
                  Tidak ada mutasi. Pilih rentang tanggal atau akun bank.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const groupInfo = statementGroupMap[item.id];
                const isInGroup = !!groupInfo;
                const hasPotentialMatch = (potentialMatchesMap[item.id]?.length ?? 0) > 0;
                const potentialMatch = potentialMatchesMap[item.id]?.[0];
                const netAmount = getNetAmount(item.credit_amount, item.debit_amount);
                const isGroupExpanded = isInGroup && expandedGroupId === groupInfo.id;
                const diff = calculateDifference(item);

                return (
                  <React.Fragment key={item.id}>
                    <tr className={`hover:bg-gray-50/50 dark:hover:bg-gray-800/30 ${isInGroup ? "border-l-2 border-l-blue-500" : ""}`}>
                      {/* Tanggal */}
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                        {formatDate(item.transaction_date)}
                      </td>

                      {/* Keterangan */}
                      <td className="px-3 py-2 max-w-xs">
                        <p className="text-gray-900 dark:text-white truncate" title={item.description}>
                          {item.description ?? "—"}
                        </p>
                        {isInGroup && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-600 dark:text-blue-400">
                            <Link2 className="w-2.5 h-2.5" /> grouped
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2">
                        <StatusBadge status={item.status} />
                      </td>

                      {/* Debit */}
                      <td className="px-3 py-2 text-right text-gray-900 dark:text-white font-mono whitespace-nowrap">
                        {item.debit_amount > 0 ? formatNumber(item.debit_amount) : ""}
                      </td>

                      {/* Kredit */}
                      <td className="px-3 py-2 text-right text-gray-900 dark:text-white font-mono whitespace-nowrap">
                        {item.credit_amount > 0 ? formatNumber(item.credit_amount) : ""}
                      </td>

                      {/* Nett POS */}
                      <td className="px-3 py-2 text-right font-mono whitespace-nowrap text-gray-600 dark:text-gray-400">
                        {item.matched_aggregate ? formatNumber(item.matched_aggregate.nett_amount) : "—"}
                      </td>

                      {/* Selisih */}
                      <td className="px-3 py-2 text-right font-mono whitespace-nowrap">
                        {diff > 0 ? (
                          <span className="text-red-600 dark:text-red-400">{formatNumber(diff)}</span>
                        ) : item.is_reconciled ? (
                          <span className="text-green-600">0</span>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-700">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!item.is_reconciled && !isInGroup && (
                            <>
                              {hasPotentialMatch ? (
                                <button
                                  onClick={() => potentialMatch?.id && onQuickMatch(item, potentialMatch.id)}
                                  className="px-2 py-1 bg-blue-600 text-white rounded text-[10px] font-medium hover:bg-blue-700 transition-colors"
                                >
                                  Match
                                </button>
                              ) : (
                                <button
                                  onClick={() => onCheckMatches?.(item.id)}
                                  disabled={isLoadingMatches[item.id]}
                                  className="px-2 py-1 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded text-[10px] font-medium hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
                                >
                                  {isLoadingMatches[item.id] ? (
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Sparkles className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                              <button
                                onClick={() => onManualMatch(item)}
                                className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-[10px] font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                              >
                                Manual
                              </button>
                            </>
                          )}

                          {item.is_reconciled && !isInGroup && (
                            <button
                              onClick={() => onUndo(item.id)}
                              className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                              title="Undo"
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {isInGroup && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setExpandedGroupId(isGroupExpanded ? null : groupInfo.id)}
                                className={`p-1 rounded transition-colors ${isGroupExpanded ? "text-blue-600 bg-blue-50 dark:bg-blue-900/20" : "text-gray-400 hover:text-gray-600"}`}
                              >
                                {isGroupExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                              {onUndoGroup && (
                                <button
                                  onClick={() => {
                                    if (confirm('Batalkan seluruh multi-match group ini?')) {
                                      onUndoGroup(groupInfo.id);
                                    }
                                  }}
                                  className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                                  title="Revert group"
                                >
                                  <Unlink2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Group Detail */}
                    {isGroupExpanded && groupInfo && (
                      <tr>
                        <td colSpan={8} className="p-0">
                          <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/30 border-l-2 border-l-blue-500 space-y-3">
                            {groupInfo.aggregate && (
                              <div className="flex items-center gap-6 text-xs text-gray-600 dark:text-gray-400">
                                <span>Aggregate: <span className="font-medium text-gray-900 dark:text-white">{groupInfo.aggregate.payment_method_name}</span></span>
                                <span>{formatDate(groupInfo.aggregate.transaction_date)}</span>
                                <span>Nett: <span className="font-mono font-medium text-gray-900 dark:text-white">{formatCurrency(groupInfo.aggregate.nett_amount)}</span></span>
                                <span>Selisih: <span className={`font-mono font-medium ${groupInfo.difference === 0 ? 'text-green-600' : 'text-amber-600'}`}>{formatCurrency(groupInfo.difference)}</span></span>
                              </div>
                            )}
                            {groupInfo.details && groupInfo.details.length > 0 && (
                              <table className="w-full text-xs">
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                  {groupInfo.details.map((detail) => {
                                    const credit = detail.statement?.credit_amount ?? 0;
                                    const debit = detail.statement?.debit_amount ?? 0;
                                    const amt = credit - debit;
                                    return (
                                      <tr key={detail.id} className="text-gray-600 dark:text-gray-400">
                                        <td className="py-1.5 pr-3 whitespace-nowrap w-24">{formatDate(detail.statement?.transaction_date)}</td>
                                        <td className="py-1.5 pr-3 truncate max-w-xs">{detail.statement?.description || "—"}</td>
                                        <td className="py-1.5 text-right font-mono whitespace-nowrap">
                                          <span className={amt >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600'}>{formatCurrency(amt)}</span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
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

      {pagination && (pagination.totalPages > 0 || pagination.total > 0) && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <Pagination
            pagination={pagination}
            onPageChange={onPageChange}
            onLimitChange={onLimitChange}
            currentLength={items.length}
          />
        </div>
      )}
    </div>
  );
}
