/**
 * BankReconciliationFilters.tsx
 *
 * Filter controls component for bank statements.
 * Provides search, status, date range, and bank account filters.
 * Uses "Apply Filters" pattern - data only fetches when user clicks Apply.
 * Includes quick date presets, inline validation, and localStorage persistence.
 */

import React, { useState, useEffect } from 'react'
import { Search, X, ChevronDown, Filter, Calendar, RefreshCw } from 'lucide-react'
import type { BankAccountStatus } from '../types/bank-reconciliation.types'
import { STORAGE_KEYS } from '../constants/reconciliation.config'

// =============================================================================
// TYPES
// =============================================================================

export type BankStatementFilterStatus = 'RECONCILED' | 'UNRECONCILED' | '';

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

const STATUS_OPTIONS: { value: BankStatementFilterStatus; label: string; description: string }[] = [
  { value: '', label: 'Semua Status', description: 'Tampilkan semua transaksi' },
  { value: 'RECONCILED', label: '✓ Reconciled', description: 'Sudah dicocokkan' },
  { value: 'UNRECONCILED', label: '○ Unreconciled', description: 'Belum dicocokkan' },
]

// =============================================================================
// HELPERS
// =============================================================================

function getToday(): string {
  return new Date().toISOString().split('T')[0]
}

function getWeekStart(): string {
  const d = new Date()
  const day = d.getDay()
  // getDay(): 0=Minggu, 1=Senin, ..., 6=Sabtu
  // Kalau Minggu (0), mundur 6 hari ke Senin. Selain itu, mundur (day-1) hari.
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  return d.toISOString().split('T')[0]
}

function getMonthStart(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// =============================================================================
// COMPONENT
// =============================================================================

interface BankReconciliationFiltersProps {
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
  const [dateError, setDateError] = useState<string | null>(null)

  // Restore filters from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LAST_FILTER)
      if (saved) {
        const parsed = JSON.parse(saved) as BankStatementFilter
        if (parsed.startDate || parsed.endDate || parsed.status || parsed.search) {
          onFiltersChange(parsed)
        }
      }
    } catch {
      // ignore parse errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist filters to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.LAST_FILTER, JSON.stringify(filters))
    } catch {
      // ignore storage errors
    }
  }, [filters])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ search: e.target.value || undefined })
  }

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as BankStatementFilterStatus
    onFiltersChange({ status: value || undefined })
  }

  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    onFiltersChange({ startDate: value || undefined })
    if (value) setDateError(null)
  }

  const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ endDate: e.target.value || undefined })
  }

  const handleDateBlur = () => {
    if (!filters.startDate && !filters.endDate) return
    if (!filters.startDate) {
      setDateError('Tanggal awal wajib diisi')
    } else if (!filters.endDate) {
      setDateError('Tanggal akhir wajib diisi')
    } else {
      setDateError(null)
    }
  }

  const handleAccountToggle = (accountId: number) => {
    const current = filters.bankAccountIds || []
    const updated = current.includes(accountId)
      ? current.filter(a => a !== accountId)
      : [...current, accountId]
    onFiltersChange({ bankAccountIds: updated.length > 0 ? updated : undefined })
  }

  const handleApplyFilters = () => {
    if (!filters.startDate || !filters.endDate) {
      setDateError('Silakan pilih rentang tanggal terlebih dahulu')
      return
    }
    setDateError(null)
    onApplyFilters(filters)
  }

  const handleClearFilters = () => {
    setDateError(null)
    onClearFilters()
    try { localStorage.removeItem(STORAGE_KEYS.LAST_FILTER) } catch { /* ignore */ }
  }

  const handleQuickDate = (startDate: string, endDate: string) => {
    setDateError(null)
    const updated = { ...filters, startDate, endDate }
    onFiltersChange({ startDate, endDate })
    onApplyFilters(updated)
  }

  const handleClearFilter = (key: keyof BankStatementFilter) => {
    const updates: Partial<BankStatementFilter> = {}
    switch (key) {
      case 'search': updates.search = undefined; break
      case 'startDate': updates.startDate = undefined; break
      case 'endDate': updates.endDate = undefined; break
      case 'status': updates.status = undefined; break
      case 'bankAccountIds': updates.bankAccountIds = undefined; break
    }
    onFiltersChange(updates)
  }

  const hasActiveFilters =
    filters.search ||
    filters.startDate ||
    filters.endDate ||
    filters.status ||
    (filters.bankAccountIds && filters.bankAccountIds.length > 0)

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
      {/* Toggle Filters */}
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 text-xs text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white transition-colors`}
          aria-label={showFilters ? 'Sembunyikan filter' : 'Tampilkan filter'}
        >
          <Filter size={16} />
          {showFilters ? 'Sembunyikan' : 'Tampilkan'} Filter
        </button>
        <div className="flex items-center gap-3">
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="px-3 py-1.5 text-[10px] text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              Hapus Semua
            </button>
          )}
          <button
            onClick={handleApplyFilters}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
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
          {/* Quick Date Presets */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span className={`text-[10px] text-gray-500 self-center mr-1`}>Cepat:</span>
            {[
              { label: 'Hari Ini', start: getToday(), end: getToday() },
              { label: 'Minggu Ini', start: getWeekStart(), end: getToday() },
              { label: 'Bulan Ini', start: getMonthStart(), end: getToday() },
            ].map(preset => (
              <button
                key={preset.label}
                onClick={() => handleQuickDate(preset.start, preset.end)}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-medium rounded-lg transition-colors h-auto cursor-pointer`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Active Filters Tags */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 mb-4">
              {filters.search && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400 rounded-full text-[10px]`}>
                  Pencarian: {filters.search}
                  <button onClick={() => handleClearFilter('search')} className="hover:text-blue-900" aria-label="Hapus pencarian">
                    <X size={12} />
                  </button>
                </span>
              )}
              {filters.startDate && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400 rounded-full text-[10px]`}>
                  Dari: {filters.startDate}
                  <button onClick={() => handleClearFilter('startDate')} className="hover:text-green-900" aria-label="Hapus tanggal awal">
                    <X size={12} />
                  </button>
                </span>
              )}
              {filters.endDate && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 rounded-full text-[10px]`}>
                  Sampai: {filters.endDate}
                  <button onClick={() => handleClearFilter('endDate')} className="hover:text-red-900" aria-label="Hapus tanggal akhir">
                    <X size={12} />
                  </button>
                </span>
              )}
              {filters.status && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-[10px]`}>
                  Status: {STATUS_OPTIONS.find(o => o.value === filters.status)?.label || filters.status}
                  <button onClick={() => handleClearFilter('status')} className="hover:text-purple-900" aria-label="Hapus status">
                    <X size={12} />
                  </button>
                </span>
              )}
              {filters.bankAccountIds && filters.bankAccountIds.length > 0 && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-[10px]`}>
                  {filters.bankAccountIds.length} Akun dipilih
                  <button onClick={() => handleClearFilter('bankAccountIds')} className="hover:text-indigo-900" aria-label="Hapus akun bank">
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
              <label htmlFor="filter-search" className={`block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1`}>
                Pencarian
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  id="filter-search"
                  type="text"
                  placeholder="Cari deskripsi atau referensi..."
                  value={filters.search || ''}
                  onChange={handleSearchChange}
                  className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pl-9 pr-9`}
                />
                {filters.search && (
                  <button
                    onClick={() => handleClearFilter('search')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    aria-label="Hapus pencarian"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Date Range - From */}
            <div className="w-40">
              <label htmlFor="filter-date-from" className={`block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1`}>
                Dari Tanggal <span className="text-red-500">*</span>
              </label>
              <input
                id="filter-date-from"
                type="date"
                value={filters.startDate || ''}
                onChange={handleDateFromChange}
                onBlur={handleDateBlur}
                className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  dateError && !filters.startDate ? 'border-red-400 dark:border-red-600' : ''
                }`}
              />
            </div>

            {/* Date Range - To */}
            <div className="w-40">
              <label htmlFor="filter-date-to" className={`block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1`}>
                Sampai Tanggal <span className="text-red-500">*</span>
              </label>
              <input
                id="filter-date-to"
                type="date"
                value={filters.endDate || ''}
                onChange={handleDateToChange}
                onBlur={handleDateBlur}
                min={filters.startDate}
                className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  dateError && !filters.endDate ? 'border-red-400 dark:border-red-600' : ''
                }`}
              />
            </div>

            {/* Bank Account Dropdown */}
            <div className="relative w-56">
              <label htmlFor="filter-bank-account" className={`block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1`}>
                Akun Bank
              </label>
              <button
                id="filter-bank-account"
                onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700`}
                aria-expanded={showAccountDropdown}
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
                        <span className="text-xs truncate text-gray-900 dark:text-white">{acc.account_name}</span>
                        <span className="text-[10px] text-gray-500 truncate">
                          {acc.banks.bank_name} • {acc.account_number}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Status Filter */}
            <div className="w-48">
              <label htmlFor="filter-status" className={`block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1`}>
                Status Transaksi
              </label>
              <select
                id="filter-status"
                value={filters.status || ''}
                onChange={handleStatusChange}
                className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value || 'all'} value={option.value} title={option.description}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Inline date validation error */}
          {dateError && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400 font-medium">
              {dateError}
            </p>
          )}
        </>
      )}
    </div>
  )
}

export default BankReconciliationFilters
