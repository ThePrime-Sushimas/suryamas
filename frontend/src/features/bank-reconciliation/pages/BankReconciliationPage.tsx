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
import { BankMutationTable } from "../components/reconciliation/BankMutationTable";
import { ManualMatchModal } from "../components/reconciliation/ManualMatchModal";
import { AutoMatchDialog } from "../components/reconciliation/AutoMatchDialog";
import { useBankReconciliation } from "../hooks/useBankReconciliation";
import { useBranchContextStore } from "@/features/branch_context/store/branchContext.store";
import type {
  BankStatementWithMatch,
  AutoMatchRequest,
} from "../types/bank-reconciliation.types";

export function BankReconciliationPage() {
  const { currentBranch } = useBranchContextStore();
  const companyId = currentBranch?.company_id || "";

  const {
    summary,
    statements,
    bankAccounts,
    isLoading,
    fetchSummary,
    fetchStatements,
    autoMatch,
    manualReconcile,
    undoReconciliation,
    fetchPotentialMatches,
    potentialMatchesMap,
    isLoadingMatches,
  } = useBankReconciliation(companyId);

  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(
    null,
  );
  const [isAutoMatchOpen, setIsAutoMatchOpen] = useState(false);
  const [selectedStatement, setSelectedStatement] =
    useState<BankStatementWithMatch | null>(null);

  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(1)).toISOString().split("T")[0], // 1st of current month
    endDate: new Date().toISOString().split("T")[0],
  });

  const handlePrevMonth = () => {
    const start = new Date(dateRange.startDate);
    start.setMonth(start.getMonth() - 1);
    start.setDate(1);

    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);

    setDateRange({
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    });
  };

  const handleNextMonth = () => {
    const start = new Date(dateRange.startDate);
    start.setMonth(start.getMonth() + 1);
    start.setDate(1);

    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);

    setDateRange({
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    });
  };

  useEffect(() => {
    if (companyId) {
      fetchSummary(dateRange.startDate, dateRange.endDate);
    }
  }, [dateRange.startDate, dateRange.endDate, companyId, fetchSummary]);

  useEffect(() => {
    if (companyId) {
      fetchStatements(
        dateRange.startDate,
        dateRange.endDate,
        selectedAccountId || undefined,
      );
    }
  }, [
    dateRange.startDate,
    dateRange.endDate,
    selectedAccountId,
    companyId,
    fetchStatements,
  ]);

  // Set initial selected account if not set
  useEffect(() => {
    if (!selectedAccountId && bankAccounts.length > 0) {
      const firstId = bankAccounts[0].id;
      // Using a microtask or macrotask to avoid synchronous state update in render
      const timeoutId = setTimeout(() => {
        setSelectedAccountId((prev) => prev || firstId);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [bankAccounts, selectedAccountId]);

  const handleAutoMatch = async (
    payload: Omit<AutoMatchRequest, "companyId">,
  ) => {
    try {
      await autoMatch({
        ...payload,
        bankAccountId: selectedAccountId || undefined,
      });
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
    if (!selectedStatement) return;
    try {
      await manualReconcile({
        aggregateId,
        statementId: selectedStatement.id,
        overrideDifference,
      });
      setSelectedStatement(null);
      // Refresh data
      fetchSummary(dateRange.startDate, dateRange.endDate);
      fetchStatements(
        dateRange.startDate,
        dateRange.endDate,
        selectedAccountId || undefined,
      );
    } catch (err) {
      console.error("Manual match error:", err);
    }
  };

  const handleManualMatchClick = (item: BankStatementWithMatch) => {
    setSelectedStatement(item);
  };

  const handleQuickMatch = async (
    item: BankStatementWithMatch,
    aggregateId: string,
  ) => {
    if (
      confirm(
        `Cocokkan transaksi ini dengan ${item.potentialMatches?.[0]?.payment_method_name} senilai ${item.potentialMatches?.[0]?.net_amount.toLocaleString("id-ID")}?`,
      )
    ) {
      try {
        await manualReconcile({
          aggregateId,
          statementId: item.id,
          overrideDifference: false,
        });
        // Refresh data
        fetchSummary(dateRange.startDate, dateRange.endDate);
        fetchStatements(
          dateRange.startDate,
          dateRange.endDate,
          selectedAccountId || undefined,
        );
      } catch (err) {
        console.error("Quick match error:", err);
      }
    }
  };

  const handleUndo = async (statementId: string) => {
    if (confirm("Apakah Anda yakin ingin membatalkan rekonsiliasi ini?")) {
      await undoReconciliation(statementId);
      // Refresh data
      fetchSummary(dateRange.startDate, dateRange.endDate);
      fetchStatements(
        dateRange.startDate,
        dateRange.endDate,
        selectedAccountId || undefined,
      );
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
            <button
              onClick={handlePrevMonth}
              className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-400" />
            </button>
            <div className="px-4 py-2 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
              <CalendarIcon className="w-4 h-4 text-blue-500" />
              <span>
                {new Date(dateRange.startDate).toLocaleDateString("id-ID", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          <button
            onClick={() => setIsAutoMatchOpen(true)}
            disabled={isLoading}
            className="group relative flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl text-sm font-bold hover:bg-blue-700 shadow-xl shadow-blue-500/20 active:scale-95 transition-all overflow-hidden disabled:opacity-50"
          >
            <div className="absolute inset-0 bg-linear-to-r from-blue-400/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
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

      {/* Bank Account Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 overflow-x-auto scrollbar-none pb-px">
        {bankAccounts.map((account) => (
          <button
            key={account.id}
            onClick={() => setSelectedAccountId(account.id)}
            className={`
              px-6 py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-3
              ${
                selectedAccountId === account.id
                  ? "border-blue-600 text-blue-600 bg-blue-50/30 dark:bg-blue-900/10"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50/50 dark:hover:bg-gray-800/50"
              }
            `}
          >
            <div className="flex flex-col items-start translate-y-0.5">
              <span className="leading-tight">{account.account_name}</span>
              <span className="text-[10px] opacity-60 font-medium">
                {account.banks.bank_name} • {account.account_number}
              </span>
            </div>
            {account.stats.unreconciled > 0 && (
              <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-5 h-5 flex items-center justify-center shadow-lg shadow-rose-500/20">
                {account.stats.unreconciled}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 gap-8">
        <BankMutationTable
          items={statements}
          potentialMatchesMap={potentialMatchesMap}
          isLoadingMatches={isLoadingMatches}
          onManualMatch={handleManualMatchClick}
          onQuickMatch={handleQuickMatch}
          onCheckMatches={fetchPotentialMatches}
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
        item={selectedStatement}
        isOpen={!!selectedStatement}
        onClose={() => setSelectedStatement(null)}
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
