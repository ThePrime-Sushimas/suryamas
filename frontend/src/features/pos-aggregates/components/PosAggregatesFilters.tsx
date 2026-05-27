/**
 * PosAggregatesFilters.tsx
 *
 * Filter controls — compact style matching pos-sync-aggregates.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { usePosAggregatesStore } from '../store/posAggregates.store'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { usePaymentMethodsStore } from '@/features/payment-methods/store/paymentMethods.store'
import type { AggregatedTransactionStatus } from '../types'
import { Search, X, ChevronDown, Filter } from 'lucide-react'

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
  { value: 'true', label: 'Sudah Rekon' },
  { value: 'false', label: 'Belum Rekon' },
]

const JOURNAL_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Semua' },
  { value: 'true', label: 'Punya Jurnal' },
  { value: 'false', label: 'Belum Jurnal' },
]

export const PosAggregatesFilters: React.FC = () => {
  const { filter, setFilter, clearFilter, fetchTransactions, fetchSummary } = usePosAggregatesStore()
  const accessibleBranches = useBranchContextStore(s => s.branches)
  const { paymentMethods, fetchPaymentMethods } = usePaymentMethodsStore()

  const branchOptions = useMemo(
    () =>
      accessibleBranches.map(b => ({
        id: b.branch_id,
        name: b.branch_name,
      })),
    [accessibleBranches],
  )

  const [selectedBranches, setSelectedBranches] = useState<string[]>([])
  const [selectedPayments, setSelectedPayments] = useState<string[]>([])
  const [showBranchDropdown, setShowBranchDropdown] = useState(false)
  const [showPaymentDropdown, setShowPaymentDropdown] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [isApplyingFilters, setIsApplyingFilters] = useState(false)

  const branchDropdownRef = useRef<HTMLDivElement>(null)
  const paymentDropdownRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    fetchPaymentMethods(1, 100)
  }, [fetchPaymentMethods])

  const handleApplyFilters = async () => {
    setIsApplyingFilters(true)
    try {
      const selectedPaymentIds = selectedPayments
        .map(name => paymentMethods.find(pm => pm.name === name)?.id)
        .filter((id): id is number => id !== undefined)

      setFilter({
        branch_names: selectedBranches.length > 0 ? selectedBranches : undefined,
        payment_method_ids: selectedPaymentIds.length > 0 ? selectedPaymentIds : undefined,
      })
      await Promise.all([fetchTransactions(1), fetchSummary()])
    } finally {
      setIsApplyingFilters(false)
    }
  }

  const handleClearFilters = () => {
    setSelectedBranches([])
    setSelectedPayments([])
    clearFilter()
  }

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
    <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <Filter size={15} />
          {showFilters ? 'Sembunyikan' : 'Tampilkan'} Filter
        </button>
        <button
          onClick={handleApplyFilters}
          disabled={isApplyingFilters}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isApplyingFilters ? 'Menerapkan...' : 'Terapkan Filter'}
        </button>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-4 items-end">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Pencarian</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                placeholder="Cari referensi..."
                value={filter.search || ''}
                onChange={(e) => setFilter({ search: e.target.value || undefined })}
                className="w-full pl-8 pr-8 py-1.5 text-sm border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
              />
              {filter.search && (
                <button
                  onClick={() => setFilter({ search: undefined })}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Date From */}
          <div className="w-36">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Dari</label>
            <input
              type="date"
              value={filter.transaction_date_from || ''}
              onChange={(e) => setFilter({ transaction_date_from: e.target.value || undefined })}
              className="w-full px-2 py-1.5 text-sm border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Date To */}
          <div className="w-36">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Sampai</label>
            <input
              type="date"
              value={filter.transaction_date_to || ''}
              onChange={(e) => setFilter({ transaction_date_to: e.target.value || undefined })}
              min={filter.transaction_date_from}
              className="w-full px-2 py-1.5 text-sm border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Branch Dropdown */}
          <div className="relative w-44" ref={branchDropdownRef}>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Cabang</label>
            <button
              onClick={() => setShowBranchDropdown(!showBranchDropdown)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm text-left flex items-center justify-between bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <span className="truncate">
                {selectedBranches.length === 0 ? 'Semua Cabang' : `${selectedBranches.length} dipilih`}
              </span>
              <ChevronDown size={14} />
            </button>
            {showBranchDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {branchOptions.map(b => (
                  <label key={b.id} className="flex items-center px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedBranches.includes(b.name)}
                      onChange={() => setSelectedBranches(prev =>
                        prev.includes(b.name) ? prev.filter(x => x !== b.name) : [...prev, b.name]
                      )}
                      className="mr-2"
                    />
                    <span className="text-xs text-gray-900 dark:text-white">{b.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Payment Method Dropdown */}
          <div className="relative w-44" ref={paymentDropdownRef}>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Metode Bayar</label>
            <button
              onClick={() => setShowPaymentDropdown(!showPaymentDropdown)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm text-left flex items-center justify-between bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <span className="truncate">
                {selectedPayments.length === 0 ? 'Semua Metode' : `${selectedPayments.length} dipilih`}
              </span>
              <ChevronDown size={14} />
            </button>
            {showPaymentDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {paymentMethods.map(pm => (
                  <label key={pm.id} className="flex items-center px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedPayments.includes(pm.name)}
                      onChange={() => setSelectedPayments(prev =>
                        prev.includes(pm.name) ? prev.filter(x => x !== pm.name) : [...prev, pm.name]
                      )}
                      className="mr-2"
                    />
                    <span className="text-sm truncate text-gray-900 dark:text-white">{pm.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Status */}
          <div className="w-36">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Status</label>
            <select
              value={filter.status || ''}
              onChange={(e) => setFilter({ status: (e.target.value as AggregatedTransactionStatus) || undefined })}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Reconciliation */}
          <div className="w-36">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Rekonsiliasi</label>
            <select
              value={filter.is_reconciled === undefined ? '' : filter.is_reconciled.toString()}
              onChange={(e) => setFilter({ is_reconciled: e.target.value === '' ? undefined : e.target.value === 'true' })}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {RECONCILED_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Journal */}
          <div className="w-36">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Jurnal</label>
            <select
              value={filter.has_journal === undefined ? '' : filter.has_journal.toString()}
              onChange={(e) => setFilter({ has_journal: e.target.value === '' ? undefined : e.target.value === 'true' })}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {JOURNAL_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Show Deleted */}
          <div className="flex items-center pb-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filter.show_deleted || false}
                onChange={(e) => setFilter({ show_deleted: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">Terhapus</span>
            </label>
          </div>

          {/* Clear */}
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-900/50"
            >
              Hapus Filter
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default PosAggregatesFilters
