import { useEffect, useState } from "react";
import { useBankVouchersStore } from "../store/bankVouchers.store";
import { BankVoucherFilters } from "../components/BankVoucherFilters";
import { BankVoucherTable } from "../components/BankVoucherTable";
import { BankVoucherSummary } from "../components/BankVoucherSummary";
import { VoucherListTab } from "../components/VoucherListTab";
import { OpeningBalanceModal } from "../components/OpeningBalanceModal";
import { ManualVoucherModal } from "../components/ManualVoucherModal";
import { useToast } from "@/contexts/ToastContext";
import { useBranchContext } from "@/features/branch_context/hooks/useBranchContext";

export const BankVouchersPage = () => {
  const { error: toastError } = useToast();
  const branchContext = useBranchContext();

  const {
    activeTab, setActiveTab,
    preview, summaryData, voucherList,
    error, clearError,
    fetchAll, fetchList,
    filter, loading,
  } = useBankVouchersStore();

  const [showOpeningBalance, setShowOpeningBalance] = useState(false);
  const [showManualVoucher, setShowManualVoucher] = useState(false);

  useEffect(() => {
    if (branchContext?.company_id) fetchAll();
  }, [branchContext?.company_id]); // eslint-disable-line

  useEffect(() => {
    if (error) { toastError(error.message); clearError(); }
  }, [error, toastError, clearError]);

  useEffect(() => {
    if (activeTab === 'list' && !voucherList) fetchList();
  }, [activeTab]); // eslint-disable-line

  const periodLabel = preview?.period_label ?? `${filter.period_month}/${filter.period_year}`;

  const handleManualSuccess = () => {
    fetchList();
    fetchAll();
  };

  return (
    <div className="h-screen flex flex-col bg-[#fdfdfd] dark:bg-gray-950 font-sans text-slate-800 dark:text-slate-200">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-8 py-5 shadow-sm relative z-20">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">
                Voucher Bank
              </h1>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
              Buku pembantu kas & bank
              <span className="w-1 h-1 bg-gray-300 rounded-full" />
              Periode {periodLabel}
            </p>
          </div>
          <BankVoucherFilters />
        </div>
      </div>

      {/* Tabs + Actions */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-8 flex items-center justify-between">
        <div className="flex gap-8">
          {([
            { key: 'voucher', label: 'BUKU MUTASI', count: preview?.summary.total_vouchers },
            { key: 'list', label: 'DAFTAR VOUCHER', count: voucherList?.total },
            { key: 'summary', label: 'RINGKASAN', count: summaryData?.by_bank.length },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-4 text-xs font-semibold tracking-wider border-b-2 transition-all relative ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && <span className="ml-2 opacity-50">[{tab.count}]</span>}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowOpeningBalance(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-gray-500 hover:text-blue-600 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg transition-all uppercase tracking-widest"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            Saldo Awal
          </button>
          <button
            onClick={() => setShowManualVoucher(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-all uppercase tracking-widest"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Buat Manual
          </button>
          <button
            onClick={() => fetchAll()}
            disabled={loading.preview || loading.summary}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all"
            title="Refresh Data"
          >
            <svg className={`w-5 h-5 ${loading.preview || loading.summary ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8 scrollbar-thin">
        <div className="max-w-[1600px] mx-auto space-y-8">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl shadow-gray-200/20 dark:shadow-none overflow-hidden">
            {activeTab === 'voucher' && <BankVoucherTable />}
            {activeTab === 'list' && <VoucherListTab />}
            {activeTab === 'summary' && (
              <div className="p-8"><BankVoucherSummary /></div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <OpeningBalanceModal isOpen={showOpeningBalance} onClose={() => setShowOpeningBalance(false)} />
      <ManualVoucherModal isOpen={showManualVoucher} onClose={() => setShowManualVoucher(false)} onSuccess={handleManualSuccess} />
    </div>
  );
};
