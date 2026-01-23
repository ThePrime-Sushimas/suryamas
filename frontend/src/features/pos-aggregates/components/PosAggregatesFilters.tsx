/**
 * PosAggregatesFilters.tsx
 * 
 * Filter controls component for aggregated transactions.
 * Provides search, status, date range, and other filter options.
 */

import React from 'react'
import { usePosAggregatesStore } from '../store/posAggregates.store'
import type { AggregatedTransactionStatus } from '../types'

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
// COMPONENT
// =============================================================================

/**
 * Filter controls component for aggregated transactions
 * Provides search, status, date range, and reconciliation filters
 */
export const PosAggregatesFilters: React.FC = () => {
  const {
    filter,
    setFilter,
    clearFilter,
  } = usePosAggregatesStore()

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilter({ search: e.target.value || undefined })
  }

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    setFilter({ status: value as AggregatedTransactionStatus | undefined })
  }

  const handleReconciledChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    setFilter({ is_reconciled: value === '' ? undefined : value === 'true' })
  }

  const handleHasJournalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    setFilter({ has_journal: value === '' ? undefined : value === 'true' })
  }

  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilter({ transaction_date_from: e.target.value || undefined })
  }

  const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilter({ transaction_date_to: e.target.value || undefined })
  }

  const handleShowDeletedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilter({ show_deleted: e.target.checked })
  }

  // Check if any filters are active
  const hasActiveFilters = 
    filter.search ||
    filter.status ||
    filter.is_reconciled !== undefined ||
    filter.has_journal !== undefined ||
    filter.transaction_date_from ||
    filter.transaction_date_to ||
    filter.show_deleted

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <div className="flex flex-wrap gap-4 items-end">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Pencarian
          </label>
          <input
            type="text"
            placeholder="Cari berdasarkan referensi atau cabang..."
            value={filter.search || ''}
            onChange={handleSearchChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
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
            onClick={clearFilter}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
          >
            Hapus Filter
          </button>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// EXPORT DEFAULT
// =============================================================================

export default PosAggregatesFilters

