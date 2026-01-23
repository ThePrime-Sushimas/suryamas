/**
 * PosAggregatesFilters.tsx
 * 
 * Filter controls component for aggregated transactions.
 * Provides search, status, date range, branch checkbox, and payment method checkbox filters.
 */

import React, { useState, useEffect } from 'react'
import { usePosAggregatesStore } from '../store/posAggregates.store'
import type { AggregatedTransactionStatus } from '../types'
import { posAggregatesApi } from '../api/posAggregates.api'
import { branchesApi } from '@/features/branches/api/branches.api'
import { Search, X, ChevronDown, ChevronUp } from 'lucide-react'

// =============================================================================
// CONFIGURATION
// =============================================================================

const STATUS_OPTIONS: { value: AggregatedTransactionStatus | ''; label: string }[] = [
  { value: '', label: 'Semua Status' },
  { value: 'READY', label: 'Siap' },
  { value: 'PENDING', label: 'Tertunda' },
  { value: 'PROCESSING', label: 'Diproses' },
  { value: 'COMPLETED', label: 'Selesai' },
  { value: 'CANCELLED', label: 'Dibatalkan' },
]

const RECONCILED_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Semua' },
  { value: 'true', label: 'Sudah Direkonsiliasi' },
  { value: 'false', label: 'Belum Direkonsiliasi' },
]

const JOURNAL_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Semua' },
  { value: 'true', label: 'Sudah Punya Jurnal' },
  { value: 'false', label: 'Belum Punya Jurnal' },
]

// =============================================================================
// TYPES
// =============================================================================

interface BranchOption {
  id: string
  branch_name: string
}

interface PaymentMethodOption {
  id: number
  name: string
  code: string
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Filter controls component for aggregated transactions
 * Provides search, status, date range, branch checkbox, and payment method checkbox filters
 */
export const PosAggregatesFilters: React.FC = () => {
  const {
    filter,
    setFilter,
    clearFilter,
  } = usePosAggregatesStore()

  const [branches, setBranches] = useState<BranchOption[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>([])
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false)

  // Fetch branches and payment methods for filter dropdowns
  useEffect(() => {
    const fetchFilterOptions = async () => {
      setLoadingBranches(true)
      setLoadingPaymentMethods(true)
      try {
        // Fetch all branches (limit 100 to get most)
        const branchesRes = await branchesApi.list(1, 100, { field: 'branch_name', order: 'asc' }, { status: 'active' })
        const branchesData = branchesRes.data || []
        
        // Fetch payment methods
        const pmData = await posAggregatesApi.getPaymentMethodOptions().catch(() => [])
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setBranches((branchesData as Array<{ id: string; branch_name: string }>).map((b: { id: string; branch_name: string }) => ({ id: b.id, branch_name: b.branch_name })))
        setPaymentMethods(pmData as PaymentMethodOption[])
      } catch (error) {
        console.error('Failed to fetch filter options:', error)
      } finally {
        setLoadingBranches(false)
        setLoadingPaymentMethods(false)
      }
    }
    fetchFilterOptions()
  }, [])

  // State for collapsible sections
  const [showBranchFilter, setShowBranchFilter] = useState(true)
  const [showPaymentMethodFilter, setShowPaymentMethodFilter] = useState(true)

  // Handle search change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilter({ search: e.target.value || undefined })
  }

  // Handle status change
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    setFilter({ status: value as AggregatedTransactionStatus | undefined })
  }

  // Handle reconciled change
  const handleReconciledChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    setFilter({ is_reconciled: value === '' ? undefined : value === 'true' })
  }

  // Handle has journal change
  const handleHasJournalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    setFilter({ has_journal: value === '' ? undefined : value === 'true' })
  }

  // Handle date from change
  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilter({ transaction_date_from: e.target.value || undefined })
  }

  // Handle date to change
  const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilter({ transaction_date_to: e.target.value || undefined })
  }

  // Handle show deleted change
  const handleShowDeletedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilter({ show_deleted: e.target.checked })
  }

  // Handle branch checkbox change
  const handleBranchChange = (branchName: string, checked: boolean) => {
    const currentBranches = filter.branch_names || []
    if (checked) {
      setFilter({ branch_names: [...currentBranches, branchName] })
    } else {
      setFilter({ branch_names: currentBranches.filter(b => b !== branchName) })
    }
  }

  // Handle payment method checkbox change
  const handlePaymentMethodChange = (pmId: number, checked: boolean) => {
    const currentPmIds = filter.payment_method_ids || []
    if (checked) {
      setFilter({ payment_method_ids: [...currentPmIds, pmId] })
    } else {
      setFilter({ payment_method_ids: currentPmIds.filter(id => id !== pmId) })
    }
  }

  // Check if any filters are active
  const hasActiveFilters = 
    filter.search ||
    filter.status ||
    filter.is_reconciled !== undefined ||
    filter.has_journal !== undefined ||
    filter.transaction_date_from ||
    filter.transaction_date_to ||
    filter.show_deleted ||
    (filter.branch_names && filter.branch_names.length > 0) ||
    (filter.payment_method_ids && filter.payment_method_ids.length > 0)

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      {/* Basic Filters Row */}
      <div className="flex flex-wrap gap-4 items-end mb-4">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Pencarian
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Cari berdasarkan referensi..."
              value={filter.search || ''}
              onChange={handleSearchChange}
              className="w-full pl-9 pr-9 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
            {filter.search && (
              <button
                onClick={() => setFilter({ search: undefined })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Date Range - From */}
        <div className="w-40">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dari Tanggal
          </label>
          <input
            type="date"
            value={filter.transaction_date_from || ''}
            onChange={handleDateFromChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Date Range - To */}
        <div className="w-40">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sampai Tanggal
          </label>
          <input
            type="date"
            value={filter.transaction_date_to || ''}
            onChange={handleDateToChange}
            min={filter.transaction_date_from}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Status */}
        <div className="w-40">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={filter.status || ''}
            onChange={handleStatusChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Reconciliation Status */}
        <div className="w-48">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status Rekonsiliasi
          </label>
          <select
            value={
              filter.is_reconciled === undefined
                ? ''
                : filter.is_reconciled.toString()
            }
            onChange={handleReconciledChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          >
            {RECONCILED_OPTIONS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Has Journal */}
        <div className="w-44">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Jurnal
          </label>
          <select
            value={
              filter.has_journal === undefined
                ? ''
                : filter.has_journal.toString()
            }
            onChange={handleHasJournalChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          >
            {JOURNAL_OPTIONS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Show Deleted Toggle */}
        <div className="flex items-center pb-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filter.show_deleted || false}
              onChange={handleShowDeletedChange}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Tampilkan Terhapus</span>
          </label>
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={() => {
              clearFilter()
              setFilter({ show_deleted: false })
            }}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
          >
            Hapus Filter
          </button>
        )}
      </div>

      {/* Collapsible Filter Sections */}
      <div className="border-t pt-4 space-y-3">
        {/* Branch Filter - Checkbox Group */}
        <div>
          <button
            onClick={() => setShowBranchFilter(!showBranchFilter)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            {showBranchFilter ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            Filter Branch ({filter.branch_names?.length || 0} dipilih)
          </button>
          {showBranchFilter && (
            <div className="mt-2 p-3 bg-gray-50 rounded-lg max-h-40 overflow-y-auto">
              {loadingBranches ? (
                <div className="text-sm text-gray-500">Memuat...</div>
              ) : branches.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {branches.map((branch) => (
                    <label
                      key={branch.id}
                      className="flex items-center gap-1 px-2 py-1 bg-white rounded border border-gray-200 cursor-pointer hover:bg-gray-100"
                    >
                      <input
                        type="checkbox"
                        checked={filter.branch_names?.includes(branch.branch_name) || false}
                        onChange={(e) => handleBranchChange(branch.branch_name, e.target.checked)}
                        className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-xs text-gray-700">{branch.branch_name}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">Tidak ada branch tersedia</div>
              )}
            </div>
          )}
        </div>

        {/* Payment Method Filter - Checkbox Group */}
        <div>
          <button
            onClick={() => setShowPaymentMethodFilter(!showPaymentMethodFilter)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            {showPaymentMethodFilter ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            Filter Metode Pembayaran ({filter.payment_method_ids?.length || 0} dipilih)
          </button>
          {showPaymentMethodFilter && (
            <div className="mt-2 p-3 bg-gray-50 rounded-lg max-h-40 overflow-y-auto">
              {loadingPaymentMethods ? (
                <div className="text-sm text-gray-500">Memuat...</div>
              ) : paymentMethods.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {paymentMethods.map((pm) => (
                    <label
                      key={pm.id}
                      className="flex items-center gap-1 px-2 py-1 bg-white rounded border border-gray-200 cursor-pointer hover:bg-gray-100"
                    >
                      <input
                        type="checkbox"
                        checked={filter.payment_method_ids?.includes(pm.id) || false}
                        onChange={(e) => handlePaymentMethodChange(pm.id, e.target.checked)}
                        className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-xs text-gray-700">{pm.name}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">Tidak ada metode pembayaran tersedia</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// EXPORT DEFAULT
// =============================================================================

export default PosAggregatesFilters

