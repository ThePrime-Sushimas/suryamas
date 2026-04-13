import { useEffect } from "react";
import { useBankVouchersStore } from "../store/bankVouchers.store";
import { BankVoucherFilters } from "../components/BankVoucherFilters";
import { BankVoucherTable } from "../components/BankVoucherTable";
import { BankVoucherSummary } from "../components/BankVoucherSummary";
import { useToast } from "@/contexts/ToastContext";
import { useBranchContext } from "@/features/branch_context/hooks/useBranchContext";

export const BankVouchersPage = () => {
  const { error: toastError } = useToast();
  const branchContext = useBranchContext();

  const {
    activeTab,
    setActiveTab,
    preview,
    summaryData,
    error,
    clearError,
    fetchAll,
    filter,
    loading,
  } = useBankVouchersStore();

  // Load data saat company context tersedia
  useEffect(() => {
    if (branchContext?.company_id) {
      fetchAll();
    }
  }, [branchContext?.company_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle error dari store
  useEffect(() => {
    if (error) {
      toastError(error.message);
      clearError();
    }
  }, [error, toastError, clearError]);

  const periodLabel =
    preview?.period_label ?? `${filter.period_month}/${filter.period_year}`;

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
              <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase rounded tracking-wider border border-blue-100 dark:border-blue-800 ml-2">
                Phase 1
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
              Buku pembantu kas & bank sistem akuntansi
              <span className="w-1 h-1 bg-gray-300 rounded-full" />
              Periode {periodLabel}
            </p>
          </div>

          <BankVoucherFilters />
        </div>
      </div>

      {/* Toolbar / Tabs */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-8 flex items-center justify-between">
        <div className="flex gap-8">
          {[
            { key: 'voucher', label: 'BUKU MUTASI (MUTATION)', count: preview?.summary.total_vouchers },
            { key: 'summary', label: 'RINGKASAN (SUMMARY)', count: summaryData?.by_bank.length },
          ].map(tab => (
            <button
               key={tab.key}
               onClick={() => setActiveTab(tab.key as 'voucher' | 'summary')}
               className={`py-4 text-xs font-semibold tracking-wider border-b-2 transition-all relative ${
                 activeTab === tab.key
                   ? 'border-blue-600 text-blue-600'
                   : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
               }`}
             >
               {tab.label}
               {tab.count !== undefined && (
                 <span className="ml-2 opacity-50">[{tab.count}]</span>
               )}
               {activeTab === tab.key && (
                 <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 shadow-sm" />
               )}
             </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
           <button className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold text-gray-500 hover:text-gray-700 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg transition-all uppercase tracking-widest">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2-8H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V9l-5-5z" />
            </svg>
            Export Excel
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

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-8 scrollbar-thin">
        <div className="max-w-[1600px] mx-auto space-y-8">
          {activeTab === 'voucher' ? (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl shadow-gray-200/20 dark:shadow-none overflow-hidden">
              <BankVoucherTable />
            </div>
          ) : (
             <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl shadow-gray-200/20 dark:shadow-none p-8">
              <BankVoucherSummary />
            </div>
          )}

          {/* Guidelines / Help */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl">
              <h5 className="text-[11px] font-bold text-blue-900 dark:text-blue-300 uppercase tracking-widest mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                Alur Mutasi (Workflow)
              </h5>
              <p className="text-xs text-blue-700/70 dark:text-blue-400/70 leading-relaxed">
                Data mutasi di halaman ini berasal dari transaksi POS yang sudah tervalidasi (Reconciled). Satu hari mutasi dikelompokkan menjadi satu Voucher BM (Bank Masuk).
              </p>
            </div>
            <div className="p-5 bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-2xl">
              <h5 className="text-[11px] font-bold text-amber-900 dark:text-amber-300 uppercase tracking-widest mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                Validasi Saldo
              </h5>
              <p className="text-xs text-amber-700/70 dark:text-amber-400/70 leading-relaxed">
                Gunakan tab "Ringkasan" untuk mencocokkan total setoran dengan mutasi rekening koran sesungguhnya per bank.
              </p>
            </div>
            <div className="p-5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl">
              <h5 className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                Integrasi Journal
              </h5>
              <p className="text-xs text-gray-400 leading-relaxed">
                Di Phase 2, tombol "Konfirmasi" akan memposting nilai mutasi ini ke Buku Besar (Journal Voucher) secara otomatis.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
