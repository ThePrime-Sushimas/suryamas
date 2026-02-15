/**
 * PosAggregatesFilters.tsx
 * 
 * Filter controls component for aggregated transactions.
 * Provides search, status, date range, branch, and payment filters.
 * Uses "Apply Filters" pattern - data only fetches when user clicks Apply.
 */

import React, { useState, useEffect, useRef } from 'react'
import { usePosAggregatesStore } from '../store/posAggregates.store'
import { useBranchesStore } from '@/features/branches/store/branches.store'
import { usePaymentMethodsStore } from '@/features/payment-methods/store/paymentMethods.store'
import type { AggregatedTransactionStatus } from '../types'
import { Search, X, ChevronDown, Filter } from 'lucide-react'

// =============================================================================
// CONFIGURATION
// =============================================================================
// jangan drubah ini selain kamu yakin
const STATUS_OPTIONS: { value: AggregatedTransactionStatus | ''; label: string }[] = [
  { value: '', label: 'ALL STATUS' },
  { value: 'READY', label: 'READY' },
  { value: 'PENDING', label: 'PENDING' },
  { value: 'PROCESSING', label: 'PROCESSING' },
  { value: 'COMPLETED', label: 'COMPLETED' },
  { value: 'CANCELLED', label: 'CANCELLED' },
  { value: 'FAILED', label: 'FAILED' },
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
// COMPONENT
// =============================================================================

/**
 * Filter controls component for aggregated transactions
 * Provides search, status, date range, branch, and payment filters
 */
export const PosAggregatesFilters: React.FC = () => {
  const { filter, setFilter, clearFilter, fetchTransactions, fetchSummary } = usePosAggregatesStore()
  const { branches, fetchBranches } = useBranchesStore()
  const { paymentMethods, fetchPaymentMethods } = usePaymentMethodsStore()
  
  // Local state for multi-select dropdowns
  const [selectedBranches, setSelectedBranches] = useState<string[]>([])
  const [selectedPayments, setSelectedPayments] = useState<string[]>([])
  const [showBranchDropdown, setShowBranchDropdown] = useState(false)
  const [showPaymentDropdown, setShowPaymentDropdown] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [isApplyingFilters, setIsApplyingFilters] = useState(false)
  
  // Refs for dropdown click outside detection
  const branchDropdownRef = useRef<HTMLDivElement>(null)
  const paymentDropdownRef = useRef<HTMLDivElement>(null)

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(event.target as Node)) {
        setShowBranchDropdown(false)
      }
      if (paymentDropdownRef.current && !paymentDropdownRef.current.contains(event.target as Node)) {
        setShowPaymentDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  // Fetch branches and payment methods on mount
  useEffect(() => {
    fetchBranches(1, 100)
    fetchPaymentMethods(1, 100)
  }, [fetchBranches, fetchPaymentMethods])

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

  // Handle branch toggle
  const handleBranchToggle = (branchName: string) => {
    setSelectedBranches(prev => 
      prev.includes(branchName) 
        ? prev.filter(b => b !== branchName)
        : [...prev, branchName]
    )
  }

  // Handle payment toggle
  const handlePaymentToggle = (paymentName: string) => {
    setSelectedPayments(prev => 
      prev.includes(paymentName) 
        ? prev.filter(p => p !== paymentName)
        : [...prev, paymentName]
    )
  }

  // Apply filters - fetch data
  const handleApplyFilters = async () => {
    setIsApplyingFilters(true)
    try {
      // Convert selected payment method names to IDs
      const selectedPaymentIds = selectedPayments
        .map(name => paymentMethods.find(pm => pm.name === name)?.id)
        .filter((id): id is number => id !== undefined)

      // Update filter with branch_names and payment_method_ids
      setFilter({
        branch_names: selectedBranches.length > 0 ? selectedBranches : undefined,
        payment_method_ids: selectedPaymentIds.length > 0 ? selectedPaymentIds : undefined,
      })
      // Fetch both transactions and summary with filters
      await Promise.all([
        fetchTransactions(1),
        fetchSummary(),
      ])
    } finally {
      setIsApplyingFilters(false)
    }
  }

  // Clear all filters
  const handleClearFilters = () => {
    setSelectedBranches([])
    setSelectedPayments([])
    clearFilter()
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
    selectedBranches.length > 0 ||
    selectedPayments.length > 0

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4">
      {/* Toggle Filters */}
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
        >
          <Filter size={16} />
          {showFilters ? 'Sembunyikan' : 'Tampilkan'} Filter
        </button>
        <button
          onClick={handleApplyFilters}
          disabled={isApplyingFilters}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {isApplyingFilters ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Memuat...
            </>
          ) : (
            'Terapkan Filter'
          )}
        </button>
      </div>

      {showFilters && (
        <>
          {/* Basic Filters Row */}
          <div className="flex flex-wrap gap-4 items-end">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Pencarian
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Cari berdasarkan referensi..."
                  value={filter.search || ''}
                  onChange={handleSearchChange}
                  className="w-full pl-9 pr-9 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                {filter.search && (
                  <button
                    onClick={() => setFilter({ search: undefined })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Date Range - From */}
            <div className="w-40">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Dari Tanggal
              </label>
              <input
                type="date"
                value={filter.transaction_date_from || ''}
                onChange={handleDateFromChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Date Range - To */}
            <div className="w-40">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Sampai Tanggal
              </label>
              <input
                type="date"
                value={filter.transaction_date_to || ''}
                onChange={handleDateToChange}
                min={filter.transaction_date_from}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Branch Dropdown */}
            <div className="relative w-48" ref={branchDropdownRef}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cabin
              </label>
              <button
                onClick={() => setShowBranchDropdown(!showBranchDropdown)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <span className="truncate">
                  {selectedBranches.length === 0 ? 'Semua Cabin' : `${selectedBranches.length} dipilih`}
                </span>
                <ChevronDown size={16} />
              </button>
              {showBranchDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-lg max-h-60 overflow-y-auto">
                  {branches.map(b => (
                    <label key={b.id} className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedBranches.includes(b.branch_name)}
                        onChange={() => handleBranchToggle(b.branch_name)}
                        className="mr-2"
                      />
                      <span className="text-sm truncate text-gray-900 dark:text-white">{b.branch_name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Payment Method Dropdown */}
            <div className="relative w-48" ref={paymentDropdownRef}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Metode Pembayaran
              </label>
              <button
                onClick={() => setShowPaymentDropdown(!showPaymentDropdown)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <span className="truncate">
                  {selectedPayments.length === 0 ? 'Semua Metode' : `${selectedPayments.length} dipilih`}
                </span>
                <ChevronDown size={16} />
              </button>
              {showPaymentDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-lg max-h-60 overflow-y-auto">
                  {paymentMethods.map(pm => (
                    <label key={pm.id} className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPayments.includes(pm.name)}
                        onChange={() => handlePaymentToggle(pm.name)}
                        className="mr-2"
                      />
                      <span className="text-sm truncate text-gray-900 dark:text-white">{pm.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Status */}
            <div className="w-40">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                value={filter.status || ''}
                onChange={handleStatusChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status Rekonsiliasi
              </label>
              <select
                value={
                  filter.is_reconciled === undefined
                    ? ''
                    : filter.is_reconciled.toString()
                }
                onChange={handleReconciledChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Jurnal
              </label>
              <select
                value={
                  filter.has_journal === undefined
                    ? ''
                    : filter.has_journal.toString()
                }
                onChange={handleHasJournalChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                  className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Tampilkan Terhapus</span>
              </label>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
              >
                Hapus Filter
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// =============================================================================
// EXPORT DEFAULT
// =============================================================================

export default PosAggregatesFilters

