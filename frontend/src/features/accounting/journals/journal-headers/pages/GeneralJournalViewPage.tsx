/**
 * GeneralJournalViewPage.tsx
 * 
 * Displays journal entries in General Journal format with all columns:
 * #, Account, Description, Branch, Notes, Project, Currency, Rate, 
 * Original Debit, Original Credit, Debit Amount (Rupiah), Credit Amount (Rupiah)
 */

import React, { useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, FileText, Download } from 'lucide-react'
import { useJournalHeadersStore } from '../store/journalHeaders.store'
import { useBranchContextStore } from '@/features/branch_context'
import type { JournalHeaderWithLines } from '../types/journal-header.types'
import type { JournalLineWithDetails } from '../../shared/journal.types'

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format currency to Indonesian Rupiah format
 */
const formatCurrency = (value: number, currency: string = 'IDR'): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Format date to Indonesian format
 */
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format number with thousand separators
 */
const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

// =============================================================================
// COMPONENT
// =============================================================================

export const GeneralJournalViewPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentBranch = useBranchContextStore((s) => s.currentBranch)

  // Date range from URL params or default to current month
  const dateFrom = searchParams.get('date_from') || new Date().toISOString().split('T')[0]
  const dateTo = searchParams.get('date_to') || new Date().toISOString().split('T')[0]
  const page = parseInt(searchParams.get('page') || '1')

  // Store
  const {
    journals,
    loading,
    pagination,
    fetchJournalsWithLines,
  } = useJournalHeadersStore()

  // Local state for sorting
  const [sortField, setSortField] = useState<'journal_date' | 'journal_number'>('journal_date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Fetch journals with lines
  const handleFetch = useCallback(() => {
    const filters: Record<string, string | number | boolean | undefined> = {
      date_from: dateFrom,
      date_to: dateTo,
    }
    if (currentBranch?.branch_id) {
      filters.branch_id = currentBranch.branch_id
    }
    // Add sort params
    filters.sort = sortField
    filters.order = sortOrder
    
    fetchJournalsWithLines(filters)
  }, [fetchJournalsWithLines, dateFrom, dateTo, currentBranch, sortField, sortOrder])

  React.useEffect(() => {
    handleFetch()
  }, [handleFetch])

  // Handle filter change
  const handleDateChange = useCallback((field: 'date_from' | 'date_to', value: string) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set(field, value)
    newParams.set('page', '1')
    setSearchParams(newParams)
  }, [searchParams, setSearchParams])

  // Handle pagination
  const handlePageChange = useCallback((newPage: number) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('page', newPage.toString())
    setSearchParams(newParams)
  }, [searchParams, setSearchParams])

  // Calculate totals for all visible journals
  const totals = useMemo(() => {
    let totalOriginalDebit = 0
    let totalOriginalCredit = 0

    journals.forEach((journal) => {
      const lines = (journal as JournalHeaderWithLines).lines || []
      lines.forEach((line) => {
        // Original amounts (from debit_amount/credit_amount)
        totalOriginalDebit += line.debit_amount || 0
        totalOriginalCredit += line.credit_amount || 0
      })
    })

    return { totalOriginalDebit, totalOriginalCredit }
  }, [journals])

  // Group lines by journal header for display
  const journalLineGroups = useMemo(() => {
    const groups: Array<{
      header: JournalHeaderWithLines
      lines: JournalLineWithDetails[]
    }> = []

    journals.forEach((journal) => {
      const header = journal as JournalHeaderWithLines
      const lines = header.lines || []
      if (lines.length > 0) {
        groups.push({ header, lines: lines as unknown as JournalLineWithDetails[] })
      }
    })

    return groups
  }, [journals])

  // Loading state
  if (loading && journals.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-500">Loading journals...</p>
        </div>
      </div>
    )
  }

  const currentPage = pagination?.page || page
  const totalPages = pagination?.totalPages || 1
  const totalItems = pagination?.total || 0

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Buku Besar Umum</h1>
          <p className="text-gray-500 mt-1">
            Laporan jurnal umum dengan format lengkap
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Cetak / PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dari Tanggal
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => handleDateChange('date_from', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sampai Tanggal
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => handleDateChange('date_to', e.target.value)}
              min={dateFrom}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Urutkan
            </label>
            <select
              value={`${sortField}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-')
                setSortField(field as 'journal_date' | 'journal_number')
                setSortOrder(order as 'asc' | 'desc')
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="journal_date-asc">Tanggal (A-Z)</option>
              <option value="journal_date-desc">Tanggal (Z-A)</option>
              <option value="journal_number-asc">Nomor Jurnal (A-Z)</option>
              <option value="journal_number-desc">Nomor Jurnal (Z-A)</option>
            </select>
          </div>
        </div>
      </div>

      {/* General Journal Table */}
      <div className="bg-white border rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-300">
                <th className="px-3 py-2 text-center font-bold text-gray-700 w-10">#</th>
                <th className="px-3 py-2 text-left font-bold text-gray-700 w-32">Account</th>
                <th className="px-3 py-2 text-left font-bold text-gray-700 w-48">Description</th>
                <th className="px-3 py-2 text-left font-bold text-gray-700 w-32">Branch</th>
                <th className="px-3 py-2 text-right font-bold text-gray-700 w-28">Original Debit</th>
                <th className="px-3 py-2 text-right font-bold text-gray-700 w-28">Original Credit</th>
                <th className="px-3 py-2 text-right font-bold text-gray-700 w-32">Debit (Rupiah)</th>
                <th className="px-3 py-2 text-right font-bold text-gray-700 w-32">Credit (Rupiah)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {journalLineGroups.map((group) => {
                const header = group.header
                const lines = group.lines
                
                return (
                  <React.Fragment key={header.id}>
                    {/* Journal Header Row */}
                    <tr className="bg-blue-50">
                      <td colSpan={8} className="px-3 py-2">
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-blue-600" />
                          <span className="font-bold text-blue-800">{header.journal_number}</span>
                          <span className="text-gray-600">{formatDate(header.journal_date)}</span>
                          <span className="text-gray-600">-</span>
                          <span className="text-gray-700">{header.description}</span>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Journal Lines */}
                    {lines.map((line, index) => {
                      const originalDebit = line.debit_amount || 0
                      const originalCredit = line.credit_amount || 0
                      const rate = line.exchange_rate || 1
                      
                      // Calculate base (Rupiah) amounts
                      const debitRupiah = line.base_debit_amount || (originalDebit * rate)
                      const creditRupiah = line.base_credit_amount || (originalCredit * rate)

                      return (
                        <tr key={line.id || index} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-center text-gray-500">
                            {line.line_number}
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-mono font-medium text-gray-900">
                              {line.account_code || line.account_id}
                            </div>
                            <div className="text-xs text-gray-500 truncate max-w-[120px]">
                              {line.account_name}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {line.description || '-'}
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {header.branch_name || '-'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-gray-700">
                            {originalDebit > 0 ? formatNumber(originalDebit) : '-'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-gray-700">
                            {originalCredit > 0 ? formatNumber(originalCredit) : '-'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-medium text-gray-900">
                            {debitRupiah > 0 ? formatCurrency(debitRupiah, 'IDR') : '-'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-medium text-gray-900">
                            {creditRupiah > 0 ? formatCurrency(creditRupiah, 'IDR') : '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </React.Fragment>
                )
              })}

              {journals.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center text-gray-500">
                    Tidak ada jurnal dalam rentang tanggal ini
                  </td>
                </tr>
              )}
            </tbody>
            
            {/* Footer with totals */}
            <tfoot className="bg-gray-100 border-t-2 border-gray-300 font-bold">
              <tr>
                <td colSpan={4} className="px-3 py-3 text-right text-gray-700">
                  TOTAL:
                </td>
                <td className="px-3 py-3 text-right font-mono text-gray-900">
                  {formatCurrency(totals.totalOriginalDebit, 'IDR')}
                </td>
                <td className="px-3 py-3 text-right font-mono text-gray-900">
                  {formatCurrency(totals.totalOriginalCredit, 'IDR')}
                </td>
                <td className="px-3 py-3"></td>
                <td className="px-3 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between mt-4 gap-4">
          <div className="text-sm text-gray-500">
            Menampilkan {journals.length} jurnal dari {totalItems} data
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Sebelumnya
            </button>
            <span className="text-sm text-gray-600 px-2">
              Halaman {currentPage} dari {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Berikutnya
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default GeneralJournalViewPage

