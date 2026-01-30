import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  ArrowLeft,
  AlertCircle,
  FileText,
  Calendar,
  Hash,
  Upload,
  Loader2
} from 'lucide-react'
import { bankStatementImportApi } from '../api/bank-statement-import.api'
import { StatusBadge } from '../components/common/StatusBadge'
import { formatCurrency, formatFileSize } from '../utils/format'
import type {
  BankStatementImport,
  BankStatementAnalysisResult,
  BankStatementImportStatus
} from '../types/bank-statement-import.types'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'


function BankStatementImportDetailPageContent() {
  const { id } = useParams<{ id: string }>()
  const [importData, setImportData] = useState<BankStatementImport | null>(null)
  const [analysisResult, setAnalysisResult] = useState<BankStatementAnalysisResult | null>(null)
  const [previewRows, setPreviewRows] = useState<Array<{
    row_number: number
    transaction_date: string
    transaction_time?: string
    description: string
    debit_amount: number
    credit_amount: number
    balance?: number
    reference_number?: string
    is_valid: boolean
    errors?: string[]
    warnings?: string[]
  }> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  // Go back handler
  const goBack = () => {
    window.history.back()
  }

  // Fetch data with useCallback to prevent infinite loop
  const fetchData = useCallback(async () => {
    if (!id) {
      return
    }

    const numericId = Number(id)
    if (isNaN(numericId)) {
      setError('ID tidak valid')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      console.log('Fetching data for ID:', numericId)

      // First, try to get summary which includes preview
      const summaryRes = await bankStatementImportApi.getSummary(numericId)
      console.log('Summary received:', summaryRes)
      console.log('Import data:', summaryRes.import)
      
      setAnalysisResult(summaryRes)
      setImportData(summaryRes.import)
      setLoading(false)
      
      // Fetch all data without pagination
      try {
        const totalRows = summaryRes.import?.total_rows || 0
        // Use limit = 0 or total_rows to get all data
        const fetchLimit = totalRows > 0 ? totalRows : 0
        const previewRes = await bankStatementImportApi.getPreview(numericId, fetchLimit)
        // Sort by transaction_date descending (newest first), then by row_number for same dates
        const sortedRows = previewRes.preview_rows?.sort((a, b) => {
          const dateA = new Date(a.transaction_date).getTime()
          const dateB = new Date(b.transaction_date).getTime()
          // If dates are different, sort by date descending (newest first)
          if (dateA !== dateB) return dateB - dateA
          // If dates are same, sort by row_number ascending
          return a.row_number - b.row_number
        }) || []
        setPreviewRows(sortedRows)
        console.log('All data fetched:', sortedRows.length, 'rows out of', previewRes.total_rows)
      } catch (previewErr) {
        console.warn('Could not fetch preview:', previewErr)
        setPreviewRows(null)
      }
      
      console.log('States updated')
    } catch (err) {
      console.error('Error fetching data:', err)
      setError(err instanceof Error ? err.message : 'Gagal memuat data')
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // // Export handler
  // const handleExport = async () => {
  //   if (!importData) return
  //   setExporting(true)
  //   try {
  //     const blob = await bankStatementImportApi.export(Number(id))
  //     const url = window.URL.createObjectURL(blob)
  //     const a = document.createElement('a')
  //     a.href = url
  //     a.download = `${importData.file_name.replace(/\.[^/.]+$/, '')}_export_${new Date().toISOString().split('T')[0]}.xlsx`
  //     document.body.appendChild(a)
  //     a.click()
  //     document.body.removeChild(a)
  //     window.URL.revokeObjectURL(url)
  //   } catch {
  //     setError('Gagal mengekspor data')
  //   } finally {
  //     setExporting(false)
  //   }
  // }

  // Confirm import handler
  const handleConfirm = async (skipDuplicates: boolean = false) => {
    if (!importData) return
    setConfirming(true)
    try {
      await bankStatementImportApi.confirm(importData.id, { skip_duplicates: skipDuplicates })
      // Refresh data after confirm
      await fetchData()
    } catch (err) {
      console.error('Error confirming import:', err)
      setError(err instanceof Error ? err.message : 'Gagal memulai import')
    } finally {
      setConfirming(false)
    }
  }

  // Check if can import (status is ANALYZED)
  const canImport = importData?.status === 'ANALYZED'

  // Loading state
  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <p className="ml-3 text-sm text-gray-600">Memuat detail import...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="font-medium text-red-900 dark:text-red-400">Error</h3>
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Not found state
  if (!importData) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-yellow-500 shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="font-medium text-yellow-900 dark:text-yellow-400">Import Tidak Ditemukan</h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                Import yang Anda cari tidak ada atau telah dihapus.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const stats = analysisResult?.stats

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={goBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Import
        </button>
        <div className="flex items-center gap-3">
          {canImport && (
            <button
              onClick={() => handleConfirm(false)}
              disabled={confirming}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {confirming ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Upload size={16} />
              )}
              {confirming ? 'Memproses...' : 'Import Semua Data'}
            </button>
          )}        </div>
      </div>

      {/* Import Info Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {importData.file_name}
            </h1>
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span className="flex items-center gap-1.5">
                <Hash className="w-4 h-4" />
                Account #{importData.bank_account_id}
              </span>
              <span className="flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                {formatFileSize(importData.file_size)}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {importData.created_at ? format(new Date(importData.created_at), 'dd MMM yyyy, HH:mm', { locale: idLocale }) : '-'}
              </span>
            </div>
          </div>
          <StatusBadge status={importData.status as BankStatementImportStatus} />
        </div>

        {/* Error Message */}
        {importData.status === 'FAILED' && importData.error_message && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
              <div>
                <h3 className="font-medium text-red-900 dark:text-red-400">Error Import</h3>
                <p className="text-sm text-red-700 dark:text-red-400 mt-1">{importData.error_message}</p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Baris</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {importData.total_rows?.toLocaleString() || 0}
            </p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">Baris Valid</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
              {stats?.valid_rows?.toLocaleString() || importData.total_rows?.toLocaleString() || 0}
            </p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">Baris Gagal</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
              {stats?.invalid_rows?.toLocaleString() || importData.failed_rows?.toLocaleString() || 0}
            </p>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">Duplikat</p>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
              {stats?.duplicate_rows?.toLocaleString() || 0}
            </p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">Baris Baru</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
              {stats?.new_rows?.toLocaleString() || 0}
            </p>
          </div>
        </div>

        {/* Date Range */}
        {(importData.date_range_start || importData.date_range_end) && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Rentang Tanggal</h3>
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Calendar className="w-4 h-4" />
              <span>
                {importData.date_range_start
                  ? format(new Date(importData.date_range_start), 'dd MMMM yyyy', { locale: idLocale })
                  : '-'}
              </span>
              <span className="text-gray-400">-</span>
              <span>
                {importData.date_range_end
                  ? format(new Date(importData.date_range_end), 'dd MMMM yyyy', { locale: idLocale })
                  : '-'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Duplicates Table */}
      {analysisResult?.duplicates && analysisResult.duplicates.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Data Duplikat ({analysisResult.duplicates.length})
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Berikut adalah data yang teridentifikasi sebagai duplikat dan mungkin akan dilewati saat import.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Tanggal
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Deskripsi
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Debit
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Kredit
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Saldo
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {analysisResult.duplicates.map((dup, index) => (
                  <tr key={`${dup.id}-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {dup.transaction_date
                        ? format(new Date(dup.transaction_date), 'dd/MM/yyyy', { locale: idLocale })
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                      {dup.description || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono text-red-600 dark:text-red-400">
                      {dup.debit > 0 ? formatCurrency(dup.debit) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono text-green-600 dark:text-green-400">
                      {dup.credit > 0 ? formatCurrency(dup.credit) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono text-gray-900 dark:text-white">
                      {formatCurrency(dup.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Warnings */}
      {analysisResult?.warnings && analysisResult.warnings.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-yellow-500 shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="font-medium text-yellow-900 dark:text-yellow-400">Peringatan</h3>
              <ul className="mt-2 space-y-1">
                {analysisResult.warnings.map((warning, index) => (
                  <li key={index} className="text-sm text-yellow-700 dark:text-yellow-400">
                    • {warning}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Preview */}
      {(() => {
        // Use previewRows state first, fallback to analysisResult.summary.preview
        const preview = previewRows || analysisResult?.summary?.preview
        if (!preview || preview.length === 0) return null
        
        return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Pratinjau Data
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Menampilkan semua {importData.total_rows?.toLocaleString() || 0} data
                </p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    No
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Tanggal
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Keterangan
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Debit
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Kredit
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Saldo
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {preview.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {row.row_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {row.transaction_date
                        ? format(new Date(row.transaction_date), 'dd/MM/yyyy', { locale: idLocale })
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                      {row.description || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono text-red-600 dark:text-red-400">
                      {row.debit_amount > 0 ? formatCurrency(row.debit_amount) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono text-green-600 dark:text-green-400">
                      {row.credit_amount > 0 ? formatCurrency(row.credit_amount) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono text-gray-900 dark:text-white">
                      {row.balance !== undefined && row.balance !== null ? formatCurrency(row.balance) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )})()}
    </div>
  )
}

export function BankStatementImportDetailPage() {
  return <BankStatementImportDetailPageContent />
}

export default BankStatementImportDetailPage

