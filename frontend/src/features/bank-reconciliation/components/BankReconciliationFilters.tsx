/**
 * BankReconciliationFilters.tsx
 * 
 * Filter controls component for bank statements.
 * Provides search, status, date range, and bank account filters.
 * Uses "Apply Filters" pattern - data only fetches when user clicks Apply.
 */

import React, { useState } from 'react'
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

const STATUS_OPTIONS: { value: BankStatementFilterStatus; label: string }[] = [
  { value: '', label: 'SEMUA STATUS' },
  { value: 'RECONCILED', label: 'RECONCILED' },
  { value: 'UNRECONCILED', label: 'BELUM COCOK' },
  { value: 'DISCREPANCY', label: 'SELISIH' },
]

const RECONCILED_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Semua' },
  { value: 'true', label: 'Sudah Direkonsiliasi' },
  { value: 'false', label: 'Belum Direkonsiliasi' },
]

// =============================================================================
// COMPONENT
// =============================================================================

interface BankReconciliationFiltersProps {
  bankAccounts: BankAccountStatus[]
  onApplyFilters: (filters: BankStatementFilter) => void
  onClearFilters: () => void
  isLoading?: boolean
}

export const BankReconciliationFilters: React.FC<BankReconciliationFiltersProps> = ({
  bankAccounts,
  onApplyFilters,
  onClearFilters,
  isLoading = false
}) => {
  // Local filter state
  const [filters, setFilters] = useState<BankStatementFilter>({
    search: '',
    startDate: '',
    endDate: '',
    status: '',
    isReconciled: undefined,
    bankAccountIds: [],
  })
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)
  const [showFilters, setShowFilters] = useState(true)

  // Handle search change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({ ...prev, search: e.target.value }))
  }

  // Handle status change
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    setFilters(prev => ({ 
      ...prev, 
      status: value as BankStatementFilterStatus
    }))
  }

  // Handle reconciled change
  const handleReconciledChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    setFilters(prev => ({ 
      ...prev, 
      isReconciled: value === '' ? undefined : value === 'true' 
    }))
  }

  // Handle date from change
  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({ ...prev, startDate: e.target.value }))
  }

  // Handle date to change
  const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({ ...prev, endDate: e.target.value }))
  }

  // Handle account toggle
  const handleAccountToggle = (accountId: number) => {
    setFilters(prev => {
      const current = prev.bankAccountIds || []
      const updated = current.includes(accountId)
        ? current.filter(a => a !== accountId)
        : [...current, accountId]
      return { ...prev, bankAccountIds: updated }
    })
  }

  // Apply filters
  const handleApplyFilters = () => {
    onApplyFilters({
      search: filters.search || undefined,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      status: filters.status || undefined,
      isReconciled: filters.isReconciled,
      bankAccountIds: filters.bankAccountIds && filters.bankAccountIds.length > 0 
        ? filters.bankAccountIds 
        : undefined,
    })
  }

  // Clear all filters
  const handleClearFilters = () => {
    setFilters({
      search: '',
      startDate: '',
      endDate: '',
      status: '',
      isReconciled: undefined,
      bankAccountIds: [],
    })
    onClearFilters()
  }

  // Check if any filters are active
  const hasActiveFilters = 
    filters.search ||
    filters.startDate ||
    filters.endDate ||
    filters.status ||
    filters.isReconciled !== undefined ||
    (filters.bankAccountIds && filters.bankAccountIds.length > 0)

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      {/* Toggle Filters */}
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <Filter size={16} />
          {showFilters ? 'Sembunyikan' : 'Tampilkan'} Filter
        </button>
        <div className="flex items-center gap-3">
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
            >
              Hapus Filter
            </button>
          )}
          <button
            onClick={handleApplyFilters}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
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
          {/* Basic Filters Row */}
          <div className="flex flex-wrap gap-4 items-end">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pencarian
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Cari deskripsi atau referensi..."
                  value={filters.search || ''}
                  onChange={handleSearchChange}
                  className="w-full pl-9 pr-9 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
                {filters.search && (
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, search: '' }))}
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
                value={filters.startDate || ''}
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
                value={filters.endDate || ''}
                onChange={handleDateToChange}
                min={filters.startDate}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Bank Account Dropdown */}
            <div className="relative w-56">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Akun Bank
              </label>
              <button
                onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                className="w-full border rounded px-3 py-2 text-sm text-left flex items-center justify-between hover:bg-gray-50"
              >
                <span className="truncate">
                  {(!filters.bankAccountIds || filters.bankAccountIds.length === 0) 
                    ? 'Semua Akun' 
                    : `${filters.bankAccountIds.length} dipilih`}
                </span>
                <ChevronDown size={16} />
              </button>
              {showAccountDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-60 overflow-y-auto">
                  {bankAccounts.map(acc => (
                    <label key={acc.id} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.bankAccountIds?.includes(acc.id) || false}
                        onChange={() => handleAccountToggle(acc.id)}
                        className="mr-2"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm truncate">{acc.account_name}</span>
                        <span className="text-xs text-gray-500 truncate">
                          {acc.banks.bank_name} • {acc.account_number}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Status */}
            <div className="w-44">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={filters.status || ''}
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
                  filters.isReconciled === undefined
                    ? ''
                    : filters.isReconciled.toString()
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

