import { useState, useCallback, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  Wallet,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Eye,
  Trash2,
} from "lucide-react";
import type { SettlementGroup, SettlementGroupStatus } from "../../types/bank-reconciliation.types";
import { DifferenceIndicator } from "../../settlement-groups/components/DifferenceIndicator";

interface SettlementGroupListProps {
  groups: SettlementGroup[];
  onViewDetails?: (groupId: string) => void;
  onDelete?: (groupId: string) => Promise<void>;
  isLoading?: boolean;
  total?: number;
}

const statusConfig: Record<SettlementGroupStatus, { color: string; bg: string; icon: typeof CheckCircle }> = {
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

// Utility function untuk formatting konsisten
const formatCurrency = (amount: number): string => {
  return amount.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function SettlementGroupList({
  groups,
  onViewDetails,
  onDelete,
  isLoading = false,
  total = 0,
}: SettlementGroupListProps) {
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      setDeletingGroupId(null);
      setError(null);
    };
  }, []);

  const toggleExpand = useCallback((groupId: string) => {
    setExpandedGroupId((prev) => (prev === groupId ? null : groupId));
    setError(null);
  }, []);

  const handleDelete = useCallback(async (groupId: string) => {
    if (!onDelete) return;
    if (!confirm("Apakah Anda yakin ingin menghapus settlement group ini?")) return;
    
    setDeletingGroupId(groupId);
    setError(null);
    try {
      await onDelete(groupId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal menghapus settlement group";
      setError(message);
      console.error("Failed to delete group:", err);
    } finally {
      setDeletingGroupId(null);
    }
  }, [onDelete]);

  // Loading state yang konsisten dengan struktur component
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 animate-pulse" />
          <div className="h-6 w-6 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {[1, 2, 3].map((i) => (
            <div key={`loading-${i}`} className="px-5 py-4 animate-pulse">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
                <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
                  <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
                <div>
                  <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
                  <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 text-center">
        <Wallet className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          Belum ada Settlement Groups
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Buat settlement group dari halaman Settlement Groups
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
          <Wallet className="w-4 h-4 text-blue-500" />
          Settlement Groups
        </h3>
        <span className="text-xs font-medium px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
          {total > 0 ? total : groups.length}
        </span>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-5 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Groups List */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {groups.map((group) => {
          const isExpanded = expandedGroupId === group.id;
          const isDeleting = deletingGroupId === group.id;
          const status = statusConfig[group.status];
          const StatusIcon = status.icon;

          return (
            <div key={group.id}>
              {/* Group Header */}
              <button
                onClick={() => toggleExpand(group.id)}
                aria-expanded={isExpanded}
                aria-controls={`settlement-group-content-${group.id}`}
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
                        {formatDateTime(group.created_at)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                          Settlement Number
                        </p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                          {group.settlement_number}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                          Tanggal
                        </p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatDate(group.settlement_date)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                    )}
                  </div>
                </div>

                {/* Summary Row - POS Match & Selisih */}
                <div className="mt-3 grid grid-cols-2 gap-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                      POS Match (Aggregates)
                    </p>
                    <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(group.total_allocated_amount)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {group.aggregates?.length || 0} transaksi
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                      Selisih
                    </p>
                    <DifferenceIndicator
                      difference={group.difference}
                      totalAmount={group.total_statement_amount}
                      size="sm"
                    />
                  </div>
                </div>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div
                  id={`settlement-group-content-${group.id}`}
                  className="px-5 py-4 bg-gray-50/50 dark:bg-gray-900/20 border-t border-gray-100 dark:border-gray-800"
                >
                  {/* Bank Statement Info */}
                  {group.bank_statement && (
                    <div className="mb-4 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                          Bank Statement
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-gray-500">Tanggal</p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {formatDate(group.bank_statement.transaction_date)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Amount</p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {formatCurrency(group.total_statement_amount)}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-gray-500">Description</p>
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {group.bank_statement.description || "-"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Aggregates List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        POS Aggregates ({group.aggregates?.length || 0})
                      </span>
                    </div>
                    {group.aggregates?.map((agg) => {
                      const aggDifference = agg.allocated_amount - agg.original_amount;
                      return (
                        <div
                          key={agg.id}
                          className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-gray-500">
                              {agg.aggregate?.transaction_date ? formatDate(agg.aggregate.transaction_date) : '-'}
                            </p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {agg.aggregate?.payment_method_name || 'Payment Gateway'}
                            </p>
                            {agg.aggregate?.branch_name && (
                              <p className="text-xs text-gray-500">
                                {agg.aggregate.branch_name}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {formatCurrency(agg.original_amount)}
                            </p>
                            {aggDifference !== 0 && (
                              <p className={`text-xs ${aggDifference > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {aggDifference > 0 ? '+' : ''}{formatCurrency(aggDifference)}
                              </p>
                            )}
                          </div>
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

                  {/* Actions */}
                  {group.status !== "UNDO" && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
                      <div className="flex gap-2">
                        {onViewDetails && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewDetails(group.id);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                            Lihat Detail
                          </button>
                        )}
                      </div>
                      {onDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(group.id);
                          }}
                          disabled={isDeleting}
                          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                        >
                          {isDeleting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Menghapus...
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-4 h-4" />
                              Hapus
                            </>
                          )}
                        </button>
                      )}
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

