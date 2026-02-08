import { useState, useCallback, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  Link2,
  Unlink2,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";
import type { ReconciliationGroup, ReconciliationGroupStatus } from "../../types/bank-reconciliation.types";

interface MultiMatchGroupProps {
  groups: ReconciliationGroup[];
  onUndoGroup: (groupId: string) => Promise<void>;
  isLoading?: boolean;
}

const statusConfig: Record<ReconciliationGroupStatus, { color: string; bg: string; icon: typeof CheckCircle }> = {
  PENDING: {
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    icon: Clock,
  },
  RECONCILED: {
    color: "text-green-700 dark:text-green-400",
    bg: "bg-green-100 dark:bg-green-900/30",
    icon: CheckCircle,
  },
  DISCREPANCY: {
    color: "text-red-700 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-900/30",
    icon: AlertTriangle,
  },
  UNDO: {
    color: "text-gray-700 dark:text-gray-400",
    bg: "bg-gray-100 dark:bg-gray-800",
    icon: XCircle,
  },
};

export function MultiMatchGroupList({
  groups,
  onUndoGroup,
  isLoading = false,
}: MultiMatchGroupProps) {
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [undoingGroupId, setUndoingGroupId] = useState<string | null>(null);

  // Cleanup: Reset undoingGroupId on unmount
  useEffect(() => {
    return () => {
      setUndoingGroupId(null);
    };
  }, []);

  const toggleExpand = useCallback((groupId: string) => {
    setExpandedGroupId((prev) => (prev === groupId ? null : groupId));
  }, []);

  const handleUndo = useCallback(async (groupId: string) => {
    setUndoingGroupId(groupId);
    try {
      await onUndoGroup(groupId);
    } catch (error) {
      console.error("Failed to undo group:", error);
    } finally {
      setUndoingGroupId(null);
    }
  }, [onUndoGroup]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
            Multi-Match Groups
          </h3>
          <span className="text-xs text-gray-500">Loading...</span>
        </div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 animate-pulse"
          >
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-3" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 text-center">
        <Link2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          Belum ada Multi-Match Groups
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Pilih statement dan buat multi-match pertama Anda
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
          <Link2 className="w-4 h-4 text-indigo-500" />
          Multi-Match Groups
        </h3>
        <span className="text-xs font-medium px-2 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-full">
          {groups.length}
        </span>
      </div>

      {/* Groups List */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {groups.map((group) => {
          const isExpanded = expandedGroupId === group.id;
          const isUndoing = undoingGroupId === group.id;
          const status = statusConfig[group.status];
          const StatusIcon = status.icon;
          const difference = group.total_bank_amount - group.aggregate_amount;
          const isWithinTolerance = Math.abs(difference) < 10000;

          return (
            <div key={group.id}>
              {/* Group Header */}
              <button
                onClick={() => toggleExpand(group.id)}
                aria-expanded={isExpanded}
                aria-controls={`group-content-${group.id}`}
                className="w-full px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${status.bg} ${status.color}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {group.status}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(group.created_at).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                          Total Bank
                        </p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          {group.total_bank_amount.toLocaleString("id-ID", {
                            style: "currency",
                            currency: "IDR",
                            maximumFractionDigits: 0,
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                          POS Aggregate
                        </p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          {group.aggregate_amount.toLocaleString("id-ID", {
                            style: "currency",
                            currency: "IDR",
                            maximumFractionDigits: 0,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                        Selisih
                      </p>
                      <p
                        className={`text-sm font-bold ${
                          isWithinTolerance
                            ? "text-green-600 dark:text-green-400"
                            : "text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {difference >= 0 ? "+" : ""}
                        {difference.toLocaleString("id-ID", {
                          style: "currency",
                          currency: "IDR",
                          maximumFractionDigits: 0,
                        })}
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                    )}
                  </div>
                </div>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div
                  id={`group-content-${group.id}`}
                  className="px-5 py-4 bg-gray-50/50 dark:bg-gray-900/20 border-t border-gray-100 dark:border-gray-800"
                >
                  {/* Aggregate Info */}
                  {group.aggregate && (
                    <div className="mb-4 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                          POS Aggregate
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-gray-500">Tanggal</p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {group.aggregate.transaction_date
                              ? new Date(group.aggregate.transaction_date).toLocaleDateString("id-ID")
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Nett Amount</p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {group.aggregate.nett_amount.toLocaleString("id-ID", {
                              style: "currency",
                              currency: "IDR",
                              maximumFractionDigits: 0,
                            })}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-gray-500">Payment Method</p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {group.aggregate.payment_method_name}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Statements List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Bank Statements ({group.details?.length || 0})
                      </span>
                    </div>
                    {group.details?.map((detail) => {
                      const statementAmount =
                        detail.statement?.credit_amount || 0 -
                        (detail.statement?.debit_amount || 0);
                      return (
                        <div
                          key={detail.id}
                          className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {detail.statement?.description || "-"}
                            </p>
                            <p className="text-xs text-gray-500">
                              {detail.statement?.transaction_date}
                            </p>
                          </div>
                          <p
                            className={`text-sm font-bold ${
                              statementAmount >= 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {Math.abs(statementAmount).toLocaleString("id-ID", {
                              style: "currency",
                              currency: "IDR",
                              maximumFractionDigits: 0,
                            })}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Notes */}
                  {group.notes && (
                    <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl">
                      <p className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-1">
                        Catatan
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-400">
                        {group.notes}
                      </p>
                    </div>
                  )}

                  {/* Audit Trail */}
                  {(group.reconciled_by || group.reconciled_at) && (
                    <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                      <span>
                        {group.reconciled_by && (
                          <>Dibuat oleh: {group.reconciled_by}</>
                        )}
                      </span>
                      <span>
                        {group.reconciled_at &&
                          new Date(group.reconciled_at).toLocaleString("id-ID")}
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  {group.status !== "UNDO" && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUndo(group.id);
                        }}
                        disabled={isUndoing}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                      >
                        {isUndoing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Membatalkan...
                          </>
                        ) : (
                          <>
                            <Unlink2 className="w-4 h-4" />
                            Batalkan Multi-Match
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

