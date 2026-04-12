import { useEffect } from 'react'
import { useBankVouchersStore } from '../store/bankVouchers.store'
import { BankVoucherFilters } from '../components/BankVoucherFilters'
import { BankVoucherTable } from '../components/BankVoucherTable'
import { BankVoucherSummary } from '../components/BankVoucherSummary'
import { useToast } from '@/contexts/ToastContext'
import { useBranchContext } from '@/features/branch_context/hooks/useBranchContext'

export const BankVouchersPage = () => {
  const { error: toastError } = useToast()
  const branchContext = useBranchContext()

  const {
    activeTab,
    setActiveTab,
    preview,
    summaryData,
    error,
    clearError,
    fetchAll,
    filter,
  } = useBankVouchersStore()

  // Load data saat company context tersedia
  useEffect(() => {
    if (branchContext?.company_id) {
      fetchAll()
    }
  }, [branchContext?.company_id])  // eslint-disable-line react-hooks/exhaustive-deps

  // Handle error dari store
  useEffect(() => {
    if (error) {
      toastError(error.message)
      clearError()
    }
  }, [error, toastError, clearError])

  const periodLabel = preview?.period_label ?? `${filter.period_month}/${filter.period_year}`

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              Buku Mutasi Bank
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Preview voucher bank masuk (BM) — periode {periodLabel}
            </p>
          </div>

          {/* Badge phase info */}
          <div className="flex items-center gap-2 mt-2 sm:mt-0">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
              Phase 1 — Bank Masuk Only
            </span>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <BankVoucherFilters />
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6">
        <div className="flex gap-0">
          {[
            { key: 'voucher', label: 'Buku Mutasi', count: preview?.summary.total_vouchers },
            { key: 'summary', label: 'Ringkasan', count: summaryData?.by_bank.length },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as 'voucher' | 'summary')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                  activeTab === tab.key
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {activeTab === 'voucher' ? (
            <div className="p-4">
              <BankVoucherTable />
            </div>
          ) : (
            <BankVoucherSummary />
          )}
        </div>

        {/* Phase 2 notice */}
        <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
          </svg>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            <strong>Phase 1:</strong> Halaman ini menampilkan Bank Masuk (BM) saja. Saldo berjalan belum 100% akurat karena Bank Keluar (BK) belum diimplementasi. Journal belum bisa di-generate dari halaman ini.
          </p>
        </div>
      </div>
    </div>
  )
}
