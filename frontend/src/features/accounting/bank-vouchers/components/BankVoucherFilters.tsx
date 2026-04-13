import { useEffect } from 'react'
import { useBankVouchersStore } from '../store/bankVouchers.store'
import { useBranchContext } from '@/features/branch_context/hooks/useBranchContext'

/**
 * Month names in Indonesian
 */
const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/**
 * Year options (current year - 5 years)
 */
const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i)

/**
 * Bank Voucher Filters Component
 * Untuk filter periode, bank, dan branch
 */
export const BankVoucherFilters = () => {
  const {
    filter,
    setFilter,
    bankAccounts,
    fetchBankAccounts,
    fetchAll,
    loading,
  } = useBankVouchersStore()

  const branchContext = useBranchContext()

  // Load bank accounts saat component mount
  useEffect(() => {
    if (branchContext?.company_id) {
      fetchBankAccounts()
    }
  }, [fetchBankAccounts, branchContext?.company_id])

  const handleApply = () => {
    fetchAll()
  }

  const isLoading = loading.preview || loading.summary

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Period Month */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Bulan
        </label>
        <select
          value={filter.period_month}
          onChange={e => setFilter({ period_month: Number(e.target.value) })}
          disabled={isLoading}
          className="px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {MONTHS.map((month, index) => (
            <option key={index + 1} value={index + 1}>
              {month}
            </option>
          ))}
        </select>
      </div>

      {/* Period Year */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Tahun
        </label>
        <select
          value={filter.period_year}
          onChange={e => setFilter({ period_year: Number(e.target.value) })}
          disabled={isLoading}
          className="px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {YEARS.map(year => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      {/* Bank Account Filter (optional) */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Bank (Opsional)
        </label>
        <select
          value={filter.bank_account_id ?? ''}
          onChange={e => setFilter({
            bank_account_id: e.target.value ? Number(e.target.value) : undefined
          })}
          disabled={isLoading || bankAccounts.length === 0}
          className="px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed min-w-48"
        >
          <option value="">
            {bankAccounts.length === 0 ? 'Memuat...' : 'Semua Bank'}
          </option>
          {bankAccounts.map(account => (
            <option key={account.id} value={account.id}>
              {account.account_name}
            </option>
          ))}
        </select>
      </div>

      {/* Apply/Refresh Button */}
      <button
        onClick={handleApply}
        disabled={isLoading}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-600 rounded-md hover:bg-blue-700 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        aria-busy={isLoading}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Memuat...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Tampilkan
          </>
        )}
      </button>

      {/* Info text */}
      <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
        {bankAccounts.length > 0 && (
          <>
            {bankAccounts.length} bank tersedia
          </>
        )}
      </span>
    </div>
  )
}
