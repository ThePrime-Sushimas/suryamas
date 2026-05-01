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
  Calendar,
  Wallet,
  User,
} from "lucide-react";
import type { ReconciliationGroup, ReconciliationGroupStatus } from "../../types/bank-reconciliation.types";
import { tailwindTheme } from "@/lib/tailwind-theme";

interface MultiMatchGroupListProps {
  groups: ReconciliationGroup[];
  onUndoGroup: (groupId: string) => Promise<void>;
  isLoading?: boolean;
}

const getStatusPattern = (status: ReconciliationGroupStatus) => {
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

export function MultiMatchGroupList({
  groups,
  onUndoGroup,
  isLoading = false,
}: MultiMatchGroupListProps) {
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [undoingGroupId, setUndoingGroupId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      setUndoingGroupId(null);
      setError(null);
    };
  }, []);

  const toggleExpand = useCallback((groupId: string) => {
    setExpandedGroupId((prev) => (prev === groupId ? null : groupId));
    setError(null);
  }, []);

  const handleUndo = useCallback(async (groupId: string) => {
    if (!confirm("Apakah Anda yakin ingin membatalkan multi-match ini?")) return;
    
    setUndoingGroupId(groupId);
    setError(null);
    try {
      await onUndoGroup(groupId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal membatalkan multi-match group";
      setError(message);
      console.error("Failed to undo group:", err);
    } finally {
      setUndoingGroupId(null);
    }
  }, [onUndoGroup]);

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
                <div className="h-5 w-24 bg-gray-100 dark:bg-gray-800 rounded-full" />
                <div className="h-3 w-40 bg-gray-50 dark:bg-gray-800/50 rounded" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Link2 className="w-8 h-8 text-indigo-300 dark:text-indigo-400" />
        </div>
        <h4 className="text-lg font-bold text-gray-900 dark:text-white">Belum ada Multi-Match Groups</h4>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-xs mx-auto leading-relaxed">
          Pilih beberapa statement dan cocokkan dengan satu aggregate untuk melihatnya di sini.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/20 dark:bg-gray-800/20">
        <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-3">
          <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
            <Link2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          Multi-Match History
        </h3>
        <span className="text-[11px] font-black px-3 py-1 bg-indigo-600 text-white rounded-full shadow-sm">
          {groups.length}
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
          const isUndoing = undoingGroupId === group.id;
          const { pattern, icon: StatusIcon } = getStatusPattern(group.status);
          const difference = group.total_bank_amount - group.aggregate_amount;
          const isWithinTolerance = Math.abs(difference) < 10000;

          return (
            <div key={group.id} className="group/item transition-all duration-200">
              {/* Group Header */}
              <button
                onClick={() => toggleExpand(group.id)}
                aria-expanded={isExpanded}
                aria-controls={`group-content-${group.id}`}
                className={`w-full px-6 py-6 text-left transition-all ${isExpanded ? 'bg-indigo-50/30 dark:bg-indigo-900/5' : 'hover:bg-gray-50/50 dark:hover:bg-gray-800/30'}`}
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
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Consolidated Bank Amount</p>
                        <p className="text-sm font-black text-gray-900 dark:text-white group-hover/item:text-indigo-600 transition-colors">
                          {formatCurrency(group.total_bank_amount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">POS Aggregate Applied</p>
                        <p className="text-sm font-black text-gray-900 dark:text-white">
                          {formatCurrency(group.aggregate_amount)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                       <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 leading-none">Net Difference</p>
                       <span className={`text-base font-black leading-none ${isWithinTolerance ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                         {difference >= 0 ? "+" : ""}
                         {formatCurrency(difference)}
                       </span>
                    </div>
                    <div className={`p-2 rounded-xl border border-gray-100 dark:border-gray-800 transition-all ${isExpanded ? 'bg-indigo-600 border-indigo-600' : 'bg-white dark:bg-gray-800'}`}>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-white" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div
                  id={`group-content-${group.id}`}
                  className="px-6 pb-6 bg-linear-to-b from-indigo-50/20 to-white dark:from-indigo-900/5 dark:to-gray-900 animate-in slide-in-from-top-4 duration-300"
                >
                  <div className="space-y-6 pt-2">
                    {/* Aggregate Info Card */}
                    {group.aggregate && (
                      <div className="p-5 bg-white dark:bg-gray-800 rounded-3xl border border-indigo-100 dark:border-indigo-900/40 shadow-sm relative overflow-hidden group/agg">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 dark:bg-indigo-900/20 rounded-full blur-2xl -mr-12 -mt-12 transition-all group-hover/agg:scale-150 duration-500" />
                        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                                 <Wallet className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Applied Aggregate</p>
                                 <p className="text-sm font-black text-gray-900 dark:text-white">
                                   {group.aggregate.payment_method_name} — {formatDate(group.aggregate.transaction_date)}
                                 </p>
                              </div>
                           </div>
                           <div className="text-left md:text-right">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Allocated POS Amount</p>
                              <p className="text-lg font-black text-gray-900 dark:text-white">
                                {formatCurrency(group.aggregate.nett_amount)}
                              </p>
                           </div>
                        </div>
                      </div>
                    )}

                    {/* Consolidated Statements List */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 px-2">
                         <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                           Consolidated Statements ({group.details?.length || 0})
                         </span>
                      </div>
                      <div className="space-y-2 max-h-80 overflow-y-auto pr-2 scrollbar-thin">
                        {group.details?.map((detail) => {
                          const credit = detail.statement?.credit_amount ?? 0;
                          const debit = detail.statement?.debit_amount ?? 0;
                          const statementAmount = credit - debit;

                          return (
                            <div
                              key={detail.id}
                              className="group/dt flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all hover:shadow-md"
                            >
                              <div className="min-w-0 flex-1 flex items-center gap-4">
                                <div className="w-1.5 h-10 bg-gray-100 dark:bg-gray-700 group-hover/dt:bg-indigo-500 rounded-full transition-colors" />
                                <div className="min-w-0">
                                  <p className="text-sm font-black text-gray-800 dark:text-gray-200 truncate pr-4">
                                    {detail.statement?.description || "Historical Record"}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                     <Calendar className="w-3 h-3 text-gray-400" />
                                     <span className="text-[10px] font-bold text-gray-400 uppercase">
                                       {formatDate(detail.statement?.transaction_date)}
                                     </span>
                                  </div>
                                </div>
                              </div>
                              <p
                                className={`text-sm font-black whitespace-nowrap ${
                                  statementAmount >= 0
                                    ? "text-green-600 dark:text-green-400"
                                    : "text-red-500 dark:text-red-400"
                                }`}
                              >
                                {statementAmount >= 0 ? "+" : ""}
                                {formatCurrency(statementAmount)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Footer Info & Actions */}
                    <div className="mt-4 pt-6 flex flex-col md:flex-row md:items-center justify-between gap-6 border-t border-gray-100 dark:border-gray-800">
                      <div className="space-y-4 flex-1">
                        {group.notes && (
                          <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/50 rounded-2xl">
                            <p className="text-[10px] font-black text-amber-800 dark:text-amber-400 uppercase tracking-widest mb-1.5">Catatan Match</p>
                            <p className="text-sm font-medium text-amber-700 dark:text-amber-300 italic">
                               "{group.notes}"
                            </p>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-6">
                           <div className="flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-gray-400" />
                              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">
                                {group.reconciled_by || 'System Auto'}
                              </span>
                           </div>
                           <div className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-gray-400" />
                              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">
                                {group.reconciled_at ? formatDateTime(group.reconciled_at) : '-'}
                              </span>
                           </div>
                        </div>
                      </div>

                      {group.status !== "UNDO" && (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUndo(group.id);
                            }}
                            disabled={isUndoing}
                            className="px-6 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-black uppercase tracking-widest hover:border-red-500 hover:text-red-600 dark:hover:border-red-500 dark:hover:text-red-400 transition-all flex items-center gap-2 active:scale-95 shadow-xs"
                          >
                            {isUndoing ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Unlink2 className="w-4 h-4" />
                            )}
                            Undo Group Match
                          </button>
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
