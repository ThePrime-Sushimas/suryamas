import { useState, useEffect } from "react";
import {
  Sparkles,
  RefreshCw,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { ReconciliationSummaryCards } from "../components/reconciliation/ReconciliationSummary";
import { DiscrepancyTable } from "../components/reconciliation/DiscrepancyTable";
import { ManualMatchModal } from "../components/reconciliation/ManualMatchModal";
import { AutoMatchDialog } from "../components/reconciliation/AutoMatchDialog";
import { useBankReconciliation } from "../hooks/useBankReconciliation";
import { useBranchContextStore } from "@/features/branch_context/store/branchContext.store";
import type {
  DiscrepancyItem,
  AutoMatchRequest,
} from "../types/bank-reconciliation.types";

export function BankReconciliationPage() {
  const { currentBranch } = useBranchContextStore();
  const companyId = currentBranch?.company_id || "";

  const {
    summary,
    discrepancies,
    isLoading,
    fetchSummary,
    fetchDiscrepancies,
    autoMatch,
    manualReconcile,
    undoReconciliation,
  } = useBankReconciliation(companyId);

  const [isAutoMatchOpen, setIsAutoMatchOpen] = useState(false);
  const [selectedDiscrepancy, setSelectedDiscrepancy] =
    useState<DiscrepancyItem | null>(null);

  const [dateRange] = useState({
    startDate: new Date(new Date().setDate(1)).toISOString().split("T")[0], // 1st of current month
    endDate: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    fetchSummary(dateRange.startDate, dateRange.endDate);
    fetchDiscrepancies(dateRange.startDate, dateRange.endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange.startDate, dateRange.endDate]);

  const handleAutoMatch = async (
    payload: Omit<AutoMatchRequest, "companyId">,
  ) => {
    try {
      await autoMatch(payload);
      setIsAutoMatchOpen(false);
      // Data is refreshed by hook autoMatch
    } catch (err) {
      console.error("Auto-match error:", err);
    }
  };

  const handleManualMatchConfirm = async (
    aggregateId: string,
    overrideDifference: boolean,
  ) => {
    if (!selectedDiscrepancy) return;
    try {
      await manualReconcile({
        aggregateId,
        statementId: selectedDiscrepancy.statementId,
        overrideDifference,
      });
      setSelectedDiscrepancy(null);
      // Refresh data
      fetchSummary(dateRange.startDate, dateRange.endDate);
      fetchDiscrepancies(dateRange.startDate, dateRange.endDate);
    } catch (err) {
      console.error("Manual match error:", err);
    }
  };

  const handleManualMatchClick = (item: unknown) => {
    setSelectedDiscrepancy(item as DiscrepancyItem);
  };

  const handleUndo = async (statementId: string) => {
    if (confirm("Apakah Anda yakin ingin membatalkan rekonsiliasi ini?")) {
      await undoReconciliation(statementId);
      // Refresh data
      fetchSummary(dateRange.startDate, dateRange.endDate);
      fetchDiscrepancies(dateRange.startDate, dateRange.endDate);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-blue-600" />
            Bank Reconciliation
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">
            Pantau dan cocokkan transaksi bank dengan catatan POS secara
            otomatis dan akurat.
          </p>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-2xl p-1 shadow-sm">
            <button className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-400" />
            </button>
            <div className="px-4 py-2 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
              <CalendarIcon className="w-4 h-4 text-blue-500" />
              <span>
                {dateRange.startDate} - {dateRange.endDate}
              </span>
            </div>
            <button className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors">
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          <button
            onClick={() => setIsAutoMatchOpen(true)}
            disabled={isLoading}
            className="group relative flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl text-sm font-bold hover:bg-blue-700 shadow-xl shadow-blue-500/20 active:scale-95 transition-all overflow-hidden disabled:opacity-50"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Auto-Match
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && <ReconciliationSummaryCards summary={summary} />}

      {/* Main Content Area */}
      <div className="grid grid-cols-1 gap-8">
        <DiscrepancyTable
          items={discrepancies}
          onManualMatch={handleManualMatchClick}
          onUndo={handleUndo}
        />
      </div>

      {/* Modals */}
      <AutoMatchDialog
        isOpen={isAutoMatchOpen}
        onClose={() => setIsAutoMatchOpen(false)}
        onConfirm={handleAutoMatch}
        isLoading={isLoading}
        dateRange={dateRange}
      />

      <ManualMatchModal
        item={selectedDiscrepancy}
        isOpen={!!selectedDiscrepancy}
        onClose={() => setSelectedDiscrepancy(null)}
        onConfirm={handleManualMatchConfirm}
        isLoading={isLoading}
      />

      {/* Tips/Helper Section */}
      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/50 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6">
        <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-2xl">
          <Sparkles className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h4 className="text-blue-900 dark:text-blue-100 font-bold mb-1 text-lg">
            Pro-Tip: Auto-Matching
          </h4>
          <p className="text-blue-700/80 dark:text-blue-200/60 text-sm leading-relaxed max-w-2xl">
            Sistem secara pintar mencocokkan transaksi berdasarkan deskripsi,
            referensi, dan nominal. Jalankan Auto-Match setelah mengimpor mutasi
            bank terbaru untuk menghemat waktu pengerjaan.
          </p>
        </div>
        <button className="md:ml-auto px-6 py-3 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 font-bold text-sm rounded-xl border border-blue-100 dark:border-blue-800 hover:shadow-lg transition-all">
          Pelajari Lebih Lanjut
        </button>
      </div>
    </div>
  );
}
