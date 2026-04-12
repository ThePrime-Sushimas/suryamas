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
  Calendar,
  FileText,
} from "lucide-react";
import type { SettlementGroup, SettlementGroupStatus } from "../../types/bank-reconciliation.types";
import { DifferenceIndicator } from "../../settlement-groups/components/DifferenceIndicator";
import { tailwindTheme } from "@/lib/tailwind-theme";

interface SettlementGroupListProps {
  groups: SettlementGroup[];
  onViewDetails?: (groupId: string) => void;
  onDelete?: (groupId: string) => Promise<void>;
  isLoading?: boolean;
  total?: number;
}

const getStatusPattern = (status: SettlementGroupStatus) => {
  switch (status) {
    case "PENDING":
      return { pattern: tailwindTheme.components.statusBadge.pending.container, icon: Clock };
    case "RECONCILED":
      return { pattern: tailwindTheme.components.statusBadge.matched.container, icon: CheckCircle };
    case "DISCREPANCY":
      return { pattern: tailwindTheme.components.statusBadge.discrepancy.container, icon: AlertTriangle };
    case "UNDO":
      return { pattern: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-700", icon: XCircle };
    default:
      return { pattern: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-700", icon: CheckCircle };
  }
};

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

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="h-5 bg-gray-100 dark:bg-gray-800 rounded-lg w-1/3 animate-pulse" />
          <div className="h-8 w-8 bg-gray-100 dark:bg-gray-800 rounded-full animate-pulse" />
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {[1, 2, 3].map((i) => (
            <div key={`loading-${i}`} className="px-6 py-6 animate-pulse">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-5 w-20 bg-gray-100 dark:bg-gray-800 rounded-full" />
                <div className="h-3 w-32 bg-gray-100 dark:bg-gray-800 rounded" />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="h-2 w-16 bg-gray-50 dark:bg-gray-800/50 rounded" />
                  <div className="h-4 w-32 bg-gray-100 dark:bg-gray-800 rounded" />
                </div>
                <div className="space-y-2">
                  <div className="h-2 w-16 bg-gray-50 dark:bg-gray-800/50 rounded" />
                  <div className="h-4 w-32 bg-gray-100 dark:bg-gray-800 rounded" />
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
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-12 text-center shadow-xs">
        <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800/50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Wallet className="w-8 h-8 text-gray-300" />
        </div>
        <h4 className="text-lg font-bold text-gray-900 dark:text-white">Belum ada Settlement Groups</h4>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-xs mx-auto leading-relaxed">
          Buat settlement group dari halaman Settlement Groups untuk melacak proses rekonsiliasi.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/30 dark:bg-gray-800/20">
        <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-3">
          <div className="p-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
            <Wallet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          Settlement Groups
        </h3>
        <span className="text-[11px] font-black px-3 py-1 bg-blue-600 text-white rounded-full shadow-sm">
          {total > 0 ? total : groups.length}
        </span>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-6 mt-6 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-2xl flex items-center gap-3 animate-in fade-in duration-300">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm font-bold text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Groups List */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {groups.map((group) => {
          const isExpanded = expandedGroupId === group.id;
          const isDeleting = deletingGroupId === group.id;
          const { pattern, icon: StatusIcon } = getStatusPattern(group.status);

          return (
            <div key={group.id} className="group/item transition-all duration-200">
              {/* Group Header */}
              <button
                onClick={() => toggleExpand(group.id)}
                aria-expanded={isExpanded}
                aria-controls={`settlement-group-content-${group.id}`}
                className={`w-full px-6 py-6 text-left transition-all ${isExpanded ? 'bg-blue-50/30 dark:bg-blue-900/5' : 'hover:bg-gray-50/50 dark:hover:bg-gray-800/30'}`}
              >
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm ${pattern}`}>
                        <StatusIcon className="w-3 h-3" strokeWidth={3} />
                        {group.status}
                      </span>
                      <div className="flex items-center gap-1.5 text-gray-400">
                        <Clock className="w-3 h-3" />
                        <span className="text-[10px] font-bold uppercase">{formatDateTime(group.created_at)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Settlement Number</p>
                        <p className="text-sm font-black text-gray-900 dark:text-white truncate group-hover/item:text-blue-600 transition-colors">
                          {group.settlement_number}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Tanggal</p>
                        <div className="flex items-center gap-2">
                           <Calendar className="w-3.5 h-3.5 text-gray-400" />
                           <p className="text-sm font-bold text-gray-900 dark:text-white">
                             {formatDate(group.settlement_date)}
                           </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`mt-1 p-2 rounded-xl border border-gray-100 dark:border-gray-800 transition-all ${isExpanded ? 'bg-blue-600 border-blue-600' : 'bg-white dark:bg-gray-800'}`}>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-white" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Summary Row */}
                <div className="mt-6 flex flex-wrap gap-8 pt-6 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                       <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">POS Match (Aggregates)</p>
                      <p className="text-sm font-black text-indigo-700 dark:text-indigo-400">
                        {formatCurrency(group.total_allocated_amount)}
                      </p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">
                        {group.aggregates?.length || 0} line items
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 border-l border-gray-100 dark:border-gray-800 pl-8">
                    <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-xl">
                       <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Status Kecocokan</p>
                      <DifferenceIndicator
                        difference={group.difference}
                        totalAmount={group.total_statement_amount}
                        size="sm"
                      />
                    </div>
                  </div>
                </div>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div
                  id={`settlement-group-content-${group.id}`}
                  className="px-6 pb-6 bg-linear-to-b from-blue-50/20 to-white dark:from-blue-900/5 dark:to-gray-900 animate-in slide-in-from-top-4 duration-300"
                >
                  <div className="space-y-6 pt-2">
                    {/* Bank Statement Card */}
                    {group.bank_statement && (
                      <div className="p-5 bg-white dark:bg-gray-800 rounded-3xl border border-blue-100 dark:border-blue-900/40 shadow-sm relative overflow-hidden group/bank">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 dark:bg-blue-900/20 rounded-full blur-2xl -mr-12 -mt-12 transition-all group-hover/bank:scale-150 duration-500" />
                        <div className="relative flex items-center justify-between gap-4">
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                                 <Wallet className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Bank Statement</p>
                                 <p className="text-sm font-black text-gray-900 dark:text-white truncate max-w-[300px]">
                                   {group.bank_statement.description || "Tanpa Deskripsi"}
                                 </p>
                              </div>
                           </div>
                           <div className="text-right">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Amount Transaksi</p>
                              <p className="text-lg font-black text-gray-900 dark:text-white">
                                {formatCurrency(group.total_statement_amount)}
                              </p>
                           </div>
                        </div>
                      </div>
                    )}

                    {/* Aggregates Detail List */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 px-2">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          Rincian POS Aggregates ({group.aggregates?.length || 0})
                        </span>
                      </div>
                      <div className="space-y-2 max-h-80 overflow-y-auto pr-2 scrollbar-thin">
                        {group.aggregates?.map((agg) => {
                          const aggDifference = agg.allocated_amount - agg.original_amount;
                          return (
                            <div
                              key={agg.id}
                              className="group/agg flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800 transition-all hover:shadow-md"
                            >
                              <div className="min-w-0 flex-1 flex items-center gap-4">
                                <div className="w-1.5 h-10 bg-gray-100 dark:bg-gray-700 group-hover/agg:bg-blue-500 rounded-full transition-colors" />
                                <div>
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                                    {agg.aggregate?.transaction_date ? formatDate(agg.aggregate.transaction_date) : '-'}
                                  </p>
                                  <p className="text-sm font-black text-gray-800 dark:text-gray-200">
                                    {agg.aggregate?.payment_method_name || 'Tidak diketahui'}
                                  </p>
                                  {agg.aggregate?.branch_name && (
                                    <p className="text-[10px] font-bold text-gray-500 italic mt-0.5">
                                      Store: {agg.aggregate.branch_name}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-black text-gray-900 dark:text-white">
                                  {formatCurrency(agg.original_amount)}
                                </p>
                                {aggDifference !== 0 && (
                                  <span className={`inline-block text-[10px] font-black px-1.5 py-0.5 rounded-md mt-1 ${aggDifference > 0 ? 'bg-green-50 text-green-700 dark:bg-green-900/30' : 'bg-red-50 text-red-700 dark:bg-red-900/30'}`}>
                                    {aggDifference > 0 ? '+' : ''}{formatCurrency(aggDifference)}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Final Action Pad */}
                    <div className="mt-4 pt-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-gray-100 dark:border-gray-800">
                      <div className="flex-1">
                         {group.notes ? (
                           <div className="flex items-start gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-800">
                              <FileText className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                                {group.notes}
                              </p>
                           </div>
                         ) : (
                           <p className="text-[10px] font-bold text-gray-400 uppercase italic">Tidak ada catatan tambahan</p>
                         )}
                      </div>
                      
                      {group.status !== "UNDO" && (
                        <div className="flex items-center gap-3">
                          {onDelete && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(group.id);
                              }}
                              disabled={isDeleting}
                              className="px-5 py-2.5 bg-white dark:bg-gray-800 text-red-600 border border-red-200 dark:border-red-900/40 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-950 transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                              {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                              Remove Group
                            </button>
                          )}
                          {onViewDetails && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onViewDetails(group.id);
                              }}
                              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all active:scale-95"
                            >
                              <Eye className="w-3 h-3" />
                              See Analytics
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
