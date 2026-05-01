import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Undo2,
  Sparkles,
  RefreshCw,
  Link2,
  ChevronDown,
  ChevronUp,
  Unlink2,
  Building,
  TrendingUp,
  Layers,
  FileText,
} from "lucide-react";
import type {
  BankStatementWithMatch,
  BankReconciliationStatus,
  PotentialMatch,
  ReconciliationGroup,
  BankAccountStatus,
} from "../../types/bank-reconciliation.types";
import {
  formatDate,
  formatCurrency,
  formatNumber,
  getNetAmount,
} from "../../utils/reconciliation.utils";
import { Pagination } from "@/components/ui/Pagination";

// ─── Match Button with Popover ───────────────────────────────────────────────

function MatchButton({
  potentialMatch,
  bankAmount,
  onConfirm,
}: {
  potentialMatch: PotentialMatch;
  bankAmount: number;
  onConfirm: () => void;
}) {
  const [showInfo, setShowInfo] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const diff = bankAmount - potentialMatch.nett_amount;

  useEffect(() => {
    if (!showInfo) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowInfo(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showInfo]);

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => setShowInfo((v) => !v)}
          className="px-2 py-1 bg-blue-600 text-white rounded-l-md text-[10px] font-medium hover:bg-blue-700 transition-colors"
        >
          Match
        </button>
        <button
          onClick={() => setShowInfo((v) => !v)}
          className="px-1 py-1 bg-blue-500 text-white rounded-r-md text-[10px] hover:bg-blue-600 transition-colors"
          title="Lihat detail"
        >
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>

      {showInfo && (
        <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 space-y-2 text-xs animate-in fade-in zoom-in-95 duration-150">
          <span className="font-bold text-gray-500 uppercase text-[10px] tracking-wider">Potential Match</span>
          <div className="space-y-1">
            {potentialMatch.transaction_date && (
              <div className="flex justify-between">
                <span className="text-gray-400">Tanggal</span>
                <span className="text-gray-700 dark:text-gray-300">{formatDate(potentialMatch.transaction_date)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">Payment</span>
              <span className="text-gray-700 dark:text-gray-300 font-medium truncate ml-2 max-w-[140px]">
                {potentialMatch.payment_method_name}
              </span>
            </div>
            {potentialMatch.branch_name && (
              <div className="flex justify-between">
                <span className="text-gray-400">Cabang</span>
                <span className="text-gray-700 dark:text-gray-300 font-medium truncate ml-2 max-w-[140px]">
                  {potentialMatch.branch_name}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">Nett Amount</span>
              <span className="font-bold text-gray-900 dark:text-white">
                {formatCurrency(potentialMatch.nett_amount)}
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-100 dark:border-gray-700 pt-1">
              <span className="text-gray-400">Selisih</span>
              <span className={`font-bold ${Math.abs(diff) < 1 ? 'text-green-600' : 'text-amber-600'}`}>
                {formatCurrency(diff)}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              setShowInfo(false);
              onConfirm();
            }}
            className="w-full py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 transition-colors"
          >
            Konfirmasi Match
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Status Badge ────────────────────────────────────────────────────────────

const STATUS_BADGE_CONFIG: Record<BankReconciliationStatus, { label: string; dot: string; badge: string }> = {
  RECONCILED: {
    label: "Reconciled",
    dot: "bg-green-500",
    badge: "text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/20",
  },
  UNRECONCILED: {
    label: "Unreconciled",
    dot: "bg-gray-400",
    badge: "text-gray-500 bg-gray-50 dark:text-gray-400 dark:bg-gray-800",
  },
};

function StatusBadge({ status }: { status: BankReconciliationStatus }) {
  const v = STATUS_BADGE_CONFIG[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${v.badge}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${v.dot}`} />
      {v.label}
    </span>
  );
}


// ─── Skeleton ─────────────────────────────────────────────────────────────────

const GRID_COLS = "grid-cols-[90px_1fr_100px_110px_110px_110px_90px_80px]";

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={`skeleton-${i}`} className={`grid ${GRID_COLS} border-b border-gray-100 dark:border-gray-800`}>
          {Array.from({ length: 8 }).map((__, j) => (
            <div
              key={j}
              className="px-3 py-2.5"
            >
              <div
                className="h-3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse"
                style={{ width: `${60 + Math.random() * 30}%` }}
              />
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

// ─── Group Detail Row ──────────────────────────────────────────────────────────

function GroupDetailRow({ group }: { group: ReconciliationGroup }) {
  return (
    <div className="border-b border-blue-100 dark:border-blue-900/30">
        <div className="px-4 py-3 bg-blue-50/60 dark:bg-blue-900/10 space-y-2">
          {/* Aggregate info */}
          {group.aggregate && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
              <span className="font-medium text-blue-800 dark:text-blue-300">
                {group.aggregate.payment_method_name}
              </span>
              <span className="text-gray-500">
                {formatDate(group.aggregate.transaction_date)}
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                Nett:{" "}
                <span className="font-medium font-mono text-gray-900 dark:text-white">
                  {formatCurrency(group.aggregate.nett_amount)}
                </span>
              </span>
              <span
                className={
                  group.difference === 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-amber-600 dark:text-amber-400"
                }
              >
                Selisih:{" "}
                <span className="font-medium font-mono">
                  {formatCurrency(group.difference)}
                </span>
              </span>
            </div>
          )}

          {/* Statement details */}
          {group.details && group.details.length > 0 && (
            <div className="rounded-md overflow-hidden border border-blue-100 dark:border-blue-900/30">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-blue-100/50 dark:bg-blue-900/20 text-[10px] text-blue-700 dark:text-blue-400">
                    <th className="px-3 py-1.5 text-left font-medium">
                      Tanggal
                    </th>
                    <th className="px-3 py-1.5 text-left font-medium">
                      Keterangan
                    </th>
                    <th className="px-3 py-1.5 text-right font-medium">
                      Jumlah
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {group.details.map((detail, idx) => {
                    const credit = detail.statement?.credit_amount ?? 0;
                    const debit = detail.statement?.debit_amount ?? 0;
                    const amt = credit - debit;
                    return (
                      <tr
                        key={detail.id}
                        className={`${
                          idx !== group.details!.length - 1
                            ? "border-b border-blue-100 dark:border-blue-900/20"
                            : ""
                        } bg-white dark:bg-gray-900`}
                      >
                        <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap w-24">
                          {formatDate(detail.statement?.transaction_date)}
                        </td>
                        <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300 max-w-60">
                          {detail.statement?.description || "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono whitespace-nowrap">
                          <span
                            className={
                              amt >= 0
                                ? "text-blue-700 dark:text-blue-400"
                                : "text-red-600 dark:text-red-400"
                            }
                          >
                            {formatCurrency(amt)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface BankMutationTableProps {
  items: BankStatementWithMatch[];
  potentialMatchesMap?: Record<string, PotentialMatch[]>;
  isLoadingMatches?: Record<string, boolean>;
  onManualMatch: (item: BankStatementWithMatch) => void;
  onQuickMatch: (item: BankStatementWithMatch, aggregateId: string) => void;
  onCheckMatches?: (statementId: string) => void;
  onUndo: (statementId: string) => void;
  onRowClick?: (item: BankStatementWithMatch) => void;
  reconciliationGroups?: ReconciliationGroup[];
  isTableLoading?: boolean;
  creditOnly?: boolean;
  onCreditOnlyChange?: (value: boolean) => void;
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
  bankAccounts?: BankAccountStatus[];
  activeBankAccountIds?: number[];
  onNonPosReconcile?: (item: BankStatementWithMatch) => void;
}

export function BankMutationTable({
  items,
  potentialMatchesMap = {},
  isLoadingMatches = {},
  onQuickMatch,
  onCheckMatches,
  onUndo,
  onRowClick,
  reconciliationGroups = [],
  isTableLoading = false,
  creditOnly = true,
  onCreditOnlyChange,
  pagination,
  onPageChange,
  onLimitChange,
  onUndoGroup,
  bankAccounts = [],
  activeBankAccountIds = [],
  onNonPosReconcile,
}: BankMutationTableProps) {
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [expandedCashDepositId, setExpandedCashDepositId] = useState<string | null>(null);

  const statementGroupMap = useMemo(() => {
    const map: Record<string, ReconciliationGroup> = {};
    reconciliationGroups.forEach((group) => {
      group.details?.forEach((detail) => {
        map[detail.statement_id] = group;
      });
    });
    return map;
  }, [reconciliationGroups]);

  const activeBankAccounts = useMemo(() => {
    if (activeBankAccountIds.length === 0) return [];
    return bankAccounts.filter((a) => activeBankAccountIds.includes(a.id));
  }, [bankAccounts, activeBankAccountIds]);

  const calculateDifference = useCallback(
    (item: BankStatementWithMatch) => {
      if (!item.is_reconciled || !item.matched_aggregate) return 0;
      // Multi-match or settlement: use pre-calculated group difference (preserve sign)
      if (
        (item.matched_aggregate.is_multi_match || item.matched_aggregate.is_settlement) &&
        item.matched_aggregate.group_difference !== undefined
      ) {
        return item.matched_aggregate.group_difference;
      }
      // 1:1 match: bank - nett (positive = surplus, negative = deficit)
      const bankAmount = getNetAmount(item.credit_amount, item.debit_amount);
      return bankAmount - item.matched_aggregate.nett_amount;
    },
    []
  );

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* ── Header ── */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Mutasi Bank
            </h3>
          </div>

          {activeBankAccounts.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {activeBankAccounts.map((acc) => (
                <div key={acc.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-full text-[11px]">
                  <Building className="w-3 h-3 text-blue-500 shrink-0" />
                  <span className="text-blue-700 dark:text-blue-300 font-medium">
                    {acc.banks.bank_name}
                  </span>
                  <span className="text-blue-300 dark:text-blue-600">·</span>
                  <span className="text-blue-600 dark:text-blue-300 max-w-[180px]">
                    {acc.account_name}
                  </span>
                  <span className="text-blue-400 dark:text-blue-500 font-mono tracking-tight">
                    ···{acc.account_number}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => onCreditOnlyChange?.(!creditOnly)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            creditOnly
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700'
              : 'bg-red-100 dark:bg-red-800 text-red-500 dark:text-red-400 border border-red-200 dark:border-red-700'
          }`}
        >
          {creditOnly ? 'Show Credit Only' : 'Show All' }
        </button>
      </div>

      {/* ── Grid Table ── */
      <div className="overflow-x-auto text-xs">
        {/* Header */}
        <div className={`grid ${GRID_COLS} bg-gray-50 dark:bg-gray-800/50 text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 border-b border-gray-200 dark:border-gray-700`}>
          <div className="px-3 py-2.5 text-left font-semibold">Tanggal</div>
          <div className="px-3 py-2.5 text-left font-semibold">Keterangan</div>
          <div className="px-3 py-2.5 text-center font-semibold">Status</div>
          <div className="px-3 py-2.5 text-right font-semibold">Debit</div>
          <div className="px-3 py-2.5 text-right font-semibold">Kredit</div>
          <div className="px-3 py-2.5 text-right font-semibold">Nett POS</div>
          <div className="px-3 py-2.5 text-right font-semibold">Selisih</div>
          <div className="px-3 py-2.5 text-center font-semibold">Aksi</div>
        </div>

        {/* Body */}
        {isTableLoading ? (
          <TableSkeleton rows={10} />
        ) : items.length === 0 ? (
          <div className="px-3 py-16 text-center text-gray-400 text-sm">
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 text-gray-300" />
              <span>Tidak ada mutasi. Pilih rentang tanggal atau akun bank.</span>
            </div>
          </div>
        ) : (
          items
          .map((item) => {
            const groupInfo = statementGroupMap[item.id];
            const isInGroup = !!groupInfo;
            const hasPotentialMatch =
              (potentialMatchesMap[item.id]?.length ?? 0) > 0;
            const potentialMatch = potentialMatchesMap[item.id]?.[0];
            const isGroupExpanded =
              isInGroup && expandedGroupId === groupInfo.id;
            const diff = calculateDifference(item);
            const groupDetailCount = groupInfo?.details?.length ?? 0;
            const isFirstInGroup = isInGroup && groupInfo.details?.[0]?.statement_id === item.id;
            const isSettlement = !!item.matched_aggregate?.is_settlement;
            const settlementAggCount = item.matched_aggregate?.settlement_aggregate_count ?? 0;

            return (
              <React.Fragment key={item.id}>
                <div
                  className={`
                    grid ${GRID_COLS} items-center border-b border-gray-100 dark:border-gray-800 transition-colors cursor-pointer
                    ${isInGroup
                      ? "bg-blue-50/30 dark:bg-blue-900/5 hover:bg-blue-50/60 dark:hover:bg-blue-900/10"
                      : "hover:bg-gray-50/70 dark:hover:bg-gray-800/40"
                    }
                  `}
                  onClick={() => {
                    if (isInGroup) {
                      setExpandedGroupId(isGroupExpanded ? null : groupInfo.id);
                    } else if (!item.is_reconciled && onRowClick) {
                      onRowClick(item);
                    }
                  }}
                >
                  {/* Tanggal */}
                  <div className="px-3 py-2.5 whitespace-nowrap">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      {formatDate(item.transaction_date)}
                    </span>
                  </div>

                  {/* Keterangan */}
                  <div className="px-3 py-2.5 min-w-0">
                    <div className="flex items-center gap-3.5">
                      <div className="min-w-0">
                        <p
                          className="text-gray-900 dark:text-white  max-w-[600px]"
                          title={item.description}
                        >
                          {item.description ?? "—"}
                        </p>
                        {item.reference_number && (
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono truncate max-w-[200px]">
                            {item.reference_number}
                          </p>
                        )}
                      </div>
                      {isInGroup && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-[10px] font-medium shrink-0 whitespace-nowrap">
                          <Link2 className="w-2.5 h-2.5" />
                          grup · {groupDetailCount}
                        </span>
                      )}
                      {isSettlement && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded text-[10px] font-medium shrink-0 whitespace-nowrap">
                          <Layers className="w-2.5 h-2.5" />
                          settlement · {settlementAggCount}
                        </span>
                      )}
                      {item.matched_aggregate?.is_bank_mutation_entry && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded text-[10px] font-medium shrink-0 whitespace-nowrap">
                          <FileText className="w-2.5 h-2.5" />
                          non-pos
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="px-3 py-2.5 text-center">
                    <StatusBadge status={item.status} />
                  </div>

                  {/* Debit */}
                  <div className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                    {item.debit_amount > 0 && (
                      <span className="text-red-600 dark:text-red-400">
                        {formatNumber(item.debit_amount)}
                      </span>
                    )}
                  </div>

                  {/* Kredit */}
                  <div className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                    {item.credit_amount > 0 && (
                      <span className="text-blue-700 dark:text-blue-400">
                        {formatNumber(item.credit_amount)}
                      </span>
                    )}
                  </div>

                  {/* Nett POS */}
                  <div className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                    {isInGroup ? (
                      isFirstInGroup && item.matched_aggregate ? (
                        <span className="text-blue-600 dark:text-blue-400" title="Group total">
                          {formatNumber(item.matched_aggregate.nett_amount)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-300 dark:text-gray-600 select-none">⤴ grup</span>
                      )
                    ) : isSettlement && item.matched_aggregate ? (
                      <span className="text-amber-600 dark:text-amber-400" title={`Settlement · ${settlementAggCount} aggregates`}>
                        {formatNumber(item.matched_aggregate.nett_amount)}
                      </span>
                    ) : item.matched_aggregate?.is_bank_mutation_entry ? (
                      <span className="text-slate-500 dark:text-slate-400" title="Non-POS Entry">
                        —
                      </span>
                    ) : item.matched_aggregate?.is_cash_deposit ? (
                      <span className="text-teal-600 dark:text-teal-400" title={`Setoran Tunai · ${item.matched_aggregate.branch_name || ''}`}>
                        {formatNumber(item.matched_aggregate.nett_amount)}
                      </span>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">
                        {item.matched_aggregate ? formatNumber(item.matched_aggregate.nett_amount) : ""}
                      </span>
                    )}
                  </div>

                  {/* Selisih */}
                  <div className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                    {(() => {
                      if (!item.is_reconciled && !isInGroup) return "";
                      // Non-first group rows
                      if (isInGroup && !isFirstInGroup) {
                        return <span className="text-[10px] text-gray-300 dark:text-gray-600 select-none">⤴ grup</span>;
                      }
                      if (diff === 0) {
                        return <span className="text-green-600 dark:text-green-400">0</span>;
                      }
                      const absDiff = Math.abs(diff);
                      const isSurplus = diff > 0;
                      const color = isSurplus
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-red-600 dark:text-red-400";
                      const prefix = isSurplus ? "+" : "-";
                      const title = isInGroup ? "Selisih grup" : isSettlement ? "Selisih settlement" : undefined;
                      return (
                        <span className={color} title={title}>
                          {prefix}{formatNumber(absDiff)}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Actions */}
                  <div className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      {/* Belum direkonsiliasi & bukan grup */}
                      {!item.is_reconciled && !isInGroup && (
                        <>
                          {hasPotentialMatch && potentialMatch ? (
                            <MatchButton
                              potentialMatch={potentialMatch}
                              bankAmount={getNetAmount(item.credit_amount, item.debit_amount)}
                              onConfirm={() => onQuickMatch(item, potentialMatch.id)}
                            />
                          ) : (
                            <button
                              onClick={() => onCheckMatches?.(item.id)}
                              disabled={isLoadingMatches[item.id]}
                              className="p-1.5 text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-md transition-colors"
                              title="Cari kecocokan"
                            >
                              {isLoadingMatches[item.id] ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Sparkles className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                          {onNonPosReconcile && (
                            <button
                              onClick={() => onNonPosReconcile(item)}
                              className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                              title="Reconcile sebagai Non-POS"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}

                      {/* Sudah rekonsiliasi, bukan grup */}
                      {item.is_reconciled && !isInGroup && (
                        <>
                          {item.matched_aggregate?.is_cash_deposit && (
                            <button
                              onClick={() => setExpandedCashDepositId(
                                expandedCashDepositId === item.id ? null : item.id
                              )}
                              className="p-1.5 text-gray-400 hover:text-teal-600 rounded-md transition-colors"
                              title="Detail setoran"
                            >
                              {expandedCashDepositId === item.id
                                ? <ChevronUp className="w-3.5 h-3.5" />
                                : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          <button
                            onClick={() => onUndo(item.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-md transition-colors"
                            title="Undo rekonsiliasi"
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}

                      {/* Bagian dari grup */}
                      {isInGroup && (
                        <>
                          <button
                            onClick={() =>
                              setExpandedGroupId(
                                isGroupExpanded ? null : groupInfo.id
                              )
                            }
                            className={`p-1.5 rounded-md transition-colors ${
                              isGroupExpanded
                                ? "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30"
                                : "text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950"
                            }`}
                            title="Detail grup"
                          >
                            {isGroupExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {onUndoGroup && (
                            <button
                              onClick={() => {
                                if (
                                  confirm(
                                    "Batalkan seluruh multi-match group ini?"
                                  )
                                ) {
                                  onUndoGroup(groupInfo.id);
                                }
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-md transition-colors"
                              title="Revert grup"
                            >
                              <Unlink2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Group Detail Row */}
                {isGroupExpanded && groupInfo && (
                  <GroupDetailRow group={groupInfo} />
                )}

                {/* Cash Deposit Detail Row */}
                {expandedCashDepositId === item.id && item.matched_aggregate?.is_cash_deposit && (
                  <div className="px-4 py-3 bg-teal-50/50 dark:bg-teal-900/10 border-t border-teal-100 dark:border-teal-800">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-gray-400 uppercase text-[10px] font-semibold">Cabang</span>
                        <p className="font-medium text-gray-900 dark:text-white">{item.matched_aggregate.branch_name || '-'}</p>
                      </div>
                      <div>
                        <span className="text-gray-400 uppercase text-[10px] font-semibold">Tanggal Setor</span>
                        <p className="font-medium text-gray-900 dark:text-white">{item.matched_aggregate.deposited_at ? new Date(item.matched_aggregate.deposited_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</p>
                      </div>
                      <div>
                        <span className="text-gray-400 uppercase text-[10px] font-semibold">Jumlah Setoran</span>
                        <p className="font-mono font-semibold text-teal-700 dark:text-teal-300">{formatNumber(item.matched_aggregate.nett_amount)}</p>
                      </div>
                      <div>
                        <span className="text-gray-400 uppercase text-[10px] font-semibold">Selisih</span>
                        <p className={`font-mono font-semibold ${Math.abs((item.credit_amount - item.debit_amount) - item.matched_aggregate.nett_amount) < 1 ? 'text-green-600' : 'text-amber-600'}`}>
                          {formatNumber((item.credit_amount - item.debit_amount) - item.matched_aggregate.nett_amount)}
                        </p>
                      </div>
                    </div>
                    {item.matched_aggregate.proof_url && (
                      <div className="mt-2">
                        <span className="text-gray-400 uppercase text-[10px] font-semibold">Bukti Setoran</span>
                        <a href={item.matched_aggregate.proof_url} target="_blank" rel="noopener noreferrer" className="mt-1 block w-fit">
                          <img src={item.matched_aggregate.proof_url} alt="Bukti setoran" className="h-20 rounded-lg border border-teal-200 dark:border-teal-700 object-cover hover:opacity-80 transition-opacity" />
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })
        )}
      </div>
}
      {/* ── Pagination ── */}
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