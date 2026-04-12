import { useEffect } from 'react'
import { useBankVouchersStore } from '../store/bankVouchers.store'
import { useBranchContext } from '@/features/branch_context/hooks/useBranchContext'

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i)

export const BankVoucherFilters = () => {
  const { filter, setFilter, bankAccounts, fetchBankAccounts, fetchAll, loading } = useBankVouchersStore()
  const branchContext = useBranchContext()

  useEffect(() => {
    fetchBankAccounts()
  }, [fetchBankAccounts, branchContext?.company_id])

  const handleApply = () => {
    fetchAll()
  }

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
          className="px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {MONTHS.map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
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
          className="px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {YEARS.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Bank Account Filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Bank
        </label>
        <select
          value={filter.bank_account_id ?? ''}
          onChange={e => setFilter({ bank_account_id: e.target.value ? Number(e.target.value) : undefined })}
          className="px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-40"
        >
          <option value="">Semua Bank</option>
          {bankAccounts.map(ba => (
            <option key={ba.id} value={ba.id}>
              {ba.account_name}
            </option>
          ))}
        </select>
      </div>

      {/* Apply Button */}
      <button
        onClick={handleApply}
        disabled={loading.preview || loading.summary}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {(loading.preview || loading.summary) ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Memuat...
          </>
        ) : 'Tampilkan'}
      </button>
    </div>
  )
}
