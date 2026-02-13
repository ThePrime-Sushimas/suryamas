/**
 * BankReconciliationFilters.tsx
 * 
 * Filter controls component for bank statements.
 * Provides search, status, date range, and bank account filters.
 * Uses "Apply Filters" pattern - data only fetches when user clicks Apply.
 * 
 * This is a controlled component - all state is managed by the parent/hook.
 */

import React, { useState, useRef } from 'react'
import { Search, X, ChevronDown, Filter, Calendar, RefreshCw } from 'lucide-react'
import type { BankAccountStatus } from '../types/bank-reconciliation.types'

// =============================================================================
// TYPES
// =============================================================================

export type BankStatementFilterStatus = 'RECONCILED' | 'UNRECONCILED' | 'DISCREPANCY' | '';

export interface BankStatementFilter {
  search?: string
  startDate?: string
  endDate?: string
  status?: BankStatementFilterStatus
  isReconciled?: boolean
  bankAccountIds?: number[]
  sort?: string
  order?: 'asc' | 'desc'
  page?: number
  limit?: number
}

// =============================================================================
// CONFIGURATION
// =============================================================================

// Status options - sesuai dengan BankReconciliationStatus di types
const STATUS_OPTIONS: { value: BankStatementFilterStatus; label: string; description: string }[] = [
  { value: '', label: 'ALL STATUS', description: 'Semua data' },
  { value: 'RECONCILED', label: 'RECONCILED', description: 'Sudah dicocokkan' },
  { value: 'UNRECONCILED', label: 'UNRECONCILED', description: 'Belum dicocokkan' },
  { value: 'DISCREPANCY', label: 'DISCREPANCY', description: 'Ada perbedaan nominal' },
]

// =============================================================================
// COMPONENT
// =============================================================================

interface BankReconciliationFiltersProps {
  // Controlled state from hook
  filters: BankStatementFilter
  onFiltersChange: (updates: Partial<BankStatementFilter>) => void
  onApplyFilters: (filters: BankStatementFilter) => void
  onClearFilters: () => void
  bankAccounts: BankAccountStatus[]
  isLoading?: boolean
}

export const BankReconciliationFilters: React.FC<BankReconciliationFiltersProps> = ({
  filters,
  onFiltersChange,
  onApplyFilters,
  onClearFilters,
  bankAccounts,
  isLoading = false
}) => {
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)
  const [showFilters, setShowFilters] = useState(true)

  // Debounced search handler using useRef
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    onFiltersChange({ search: value })
    
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    // Set new timeout
    searchTimeoutRef.current = setTimeout(() => {
      onFiltersChange({ search: value || undefined })
    }, 300)
  }

  // Handle status change
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as BankStatementFilterStatus
    onFiltersChange({ status: value || undefined })
  }

  // Handle date from change
  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ startDate: e.target.value || undefined })
  }

  // Handle date to change
  const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ endDate: e.target.value || undefined })
  }

  // Handle account toggle
  const handleAccountToggle = (accountId: number) => {
    const current = filters.bankAccountIds || []
    const updated = current.includes(accountId)
      ? current.filter(a => a !== accountId)
      : [...current, accountId]
    onFiltersChange({ bankAccountIds: updated.length > 0 ? updated : undefined })
  }

  // Apply filters
  const handleApplyFilters = () => {
    onApplyFilters(filters)
  }

  // Clear all filters
  const handleClearFilters = () => {
    onClearFilters()
  }

  // Clear individual filter
  const handleClearFilter = (key: keyof BankStatementFilter) => {
    const updates: Partial<BankStatementFilter> = {}
    switch (key) {
      case 'search':
        updates.search = undefined
        break
      case 'startDate':
        updates.startDate = undefined
        break
      case 'endDate':
        updates.endDate = undefined
        break
      case 'status':
        updates.status = undefined
        break
      case 'bankAccountIds':
        updates.bankAccountIds = undefined
        break
    }
    onFiltersChange(updates)
  }

  // Check if any filters are active
  const hasActiveFilters = 
    filters.search ||
    filters.startDate ||
    filters.endDate ||
    filters.status ||
    (filters.bankAccountIds && filters.bankAccountIds.length > 0)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-4 mb-4">
      {/* Toggle Filters */}
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <Filter size={16} />
          {showFilters ? 'Sembunyikan' : 'Tampilkan'} Filter
        </button>
        <div className="flex items-center gap-3">
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              Hapus Semua
            </button>
          )}
          <button
            onClick={handleApplyFilters}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {isLoading ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Memuat...
              </>
            ) : (
              <>
                <Calendar size={16} />
                Terapkan Filter
              </>
            )}
          </button>
        </div>
      </div>

      {showFilters && (
        <>
          {/* Active Filters Tags */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 mb-4">
              {filters.search && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs">
                  Pencarian: {filters.search}
                  <button onClick={() => handleClearFilter('search')} className="hover:text-blue-900">
                    <X size={12} />
                  </button>
                </span>
              )}
              {filters.startDate && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs">
                  Dari: {filters.startDate}
                  <button onClick={() => handleClearFilter('startDate')} className="hover:text-green-900">
                    <X size={12} />
                  </button>
                </span>
              )}
              {filters.endDate && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full text-xs">
                  Sampai: {filters.endDate}
                  <button onClick={() => handleClearFilter('endDate')} className="hover:text-red-900">
                    <X size={12} />
                  </button>
                </span>
              )}
              {filters.status && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs">
                  Status: {STATUS_OPTIONS.find(o => o.value === filters.status)?.label || filters.status}
                  <button onClick={() => handleClearFilter('status')} className="hover:text-purple-900">
                    <X size={12} />
                  </button>
                </span>
              )}
              {filters.bankAccountIds && filters.bankAccountIds.length > 0 && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-xs">
                  {filters.bankAccountIds.length} Akun dipilih
                  <button onClick={() => handleClearFilter('bankAccountIds')} className="hover:text-indigo-900">
                    <X size={12} />
                  </button>
                </span>
              )}
            </div>
          )}

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
                  placeholder="Cari deskripsi atau referensi..."
                  value={filters.search || ''}
                  onChange={handleSearchChange}
                  className="w-full pl-9 pr-9 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                {filters.search && (
                  <button
                    onClick={() => handleClearFilter('search')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
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
                value={filters.startDate || ''}
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
                value={filters.endDate || ''}
                onChange={handleDateToChange}
                min={filters.startDate}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Bank Account Dropdown */}
            <div className="relative w-56">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Akun Bank
              </label>
              <button
                onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <span className="truncate">
                  {(!filters.bankAccountIds || filters.bankAccountIds.length === 0) 
                    ? 'Semua Akun' 
                    : `${filters.bankAccountIds.length} dipilih`}
                </span>
                <ChevronDown size={16} className="text-gray-400" />
              </button>
              {showAccountDropdown && (
                <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg max-h-60 overflow-y-auto">
                  {bankAccounts.map(acc => (
                    <label key={acc.id} className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.bankAccountIds?.includes(acc.id) || false}
                        onChange={() => handleAccountToggle(acc.id)}
                        className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm truncate text-gray-900 dark:text-white">{acc.account_name}</span>
                        <span className="text-xs text-gray-500 truncate">
                          {acc.banks.bank_name} • {acc.account_number}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Status Filter - Sederhana dan Jelas */}
            <div className="w-48">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status Transaksi
              </label>
              <select
                value={filters.status || ''}
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
          </div>
        </>
      )}
    </div>
  )
}

// =============================================================================
// EXPORT
// =============================================================================

export default BankReconciliationFilters

