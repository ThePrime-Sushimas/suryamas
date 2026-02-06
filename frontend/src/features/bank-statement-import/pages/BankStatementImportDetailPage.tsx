import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import {
  ArrowLeft,
  AlertCircle,
  FileText,
  Calendar,
  Hash,
  Upload,
  Loader2,
  Maximize2,
  X,
  Eye,
  CheckCircle2,
  AlertTriangle,
  XCircle
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
  
  // Description modal state
  const [showDescriptionModal, setShowDescriptionModal] = useState(false)
  const [selectedDescription, setSelectedDescription] = useState<string>('')
  const [selectedRowInfo, setSelectedRowInfo] = useState<{ rowNumber: number; date: string } | null>(null)
  
  // Tab state for preview
  const [activePreviewTab, setActivePreviewTab] = useState<'all' | 'valid' | 'duplicate' | 'invalid'>('all')

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

      // First, try to get summary which includes preview
      const summaryRes = await bankStatementImportApi.getSummary(numericId)
      setAnalysisResult(summaryRes)
      setImportData(summaryRes.import)
      setLoading(false)
      
      // Fetch all data without pagination
      try {
        const totalRows = summaryRes.import?.total_rows || 0
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
      } catch {
        setPreviewRows(null)
      }
    } catch (err) {
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

  // Get duplicate row numbers for filtering
  const duplicateRowNumbers = useMemo(() => {
    const rowNums = new Set<number>()
    analysisResult?.duplicates?.forEach((dup: unknown) => {
      const d = dup as { row_numbers?: number[]; row_number?: number }
      if (d.row_numbers && Array.isArray(d.row_numbers)) {
        d.row_numbers.forEach(num => rowNums.add(num))
      } else if (d.row_number) {
        rowNums.add(d.row_number)
      }
    })
    return rowNums
  }, [analysisResult?.duplicates])

  // Filter preview rows based on active tab
  const filteredPreviewRows = useMemo(() => {
    if (!previewRows) return []
    
    switch (activePreviewTab) {
      case 'valid':
        return previewRows.filter(row => row.is_valid && !duplicateRowNumbers.has(row.row_number))
      case 'duplicate':
        return previewRows.filter(row => duplicateRowNumbers.has(row.row_number))
      case 'invalid':
        return previewRows.filter(row => !row.is_valid)
      case 'all':
      default:
        return previewRows
    }
  }, [previewRows, activePreviewTab, duplicateRowNumbers])

  // Count rows by status
  const validCount = previewRows?.filter(row => row.is_valid && !duplicateRowNumbers.has(row.row_number)).length || 0
  const duplicateCount = previewRows?.filter(row => duplicateRowNumbers.has(row.row_number)).length || 0
  const invalidCount = previewRows?.filter(row => !row.is_valid).length || 0

  // Open description modal
  const openDescriptionModal = (description: string, rowNumber: number, date: string) => {
    setSelectedDescription(description)
    setSelectedRowInfo({ rowNumber, date })
    setShowDescriptionModal(true)
  }

  // Close description modal
  const closeDescriptionModal = () => {
    setShowDescriptionModal(false)
    setSelectedDescription('')
    setSelectedRowInfo(null)
  }

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
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl overflow-hidden">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-lg shrink-0">
                <AlertCircle className="text-red-500" size={20} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 dark:text-red-400">Terjadi Kesalahan</h3>
                <p className="text-sm text-red-700 dark:text-red-400 mt-1">{error}</p>
                
                {/* Action Buttons */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={goBack}
                    className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-1"
                  >
                    <ArrowLeft size={14} />
                    Kembali
                  </button>
                  <button
                    onClick={fetchData}
                    className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                  >
                    Coba Lagi
                  </button>
                </div>
              </div>
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
                {importData.bank_name && importData.account_number
                  ? `${importData.bank_name} - ${importData.account_number}`
                  : importData.account_number
                    ? importData.account_number
                    : `Account #${importData.bank_account_id}`
                }
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

        {/* Error Message - Enhanced */}
        {importData.status === 'FAILED' && importData.error_message && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl overflow-hidden">
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-lg shrink-0">
                  <AlertCircle className="text-red-500" size={20} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-red-900 dark:text-red-400">Import Gagal</h3>
                  <p className="text-sm text-red-700 dark:text-red-400 mt-1">{importData.error_message}</p>
                  
                  {/* Recovery suggestion */}
                  <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-red-100 dark:border-red-800">
                    <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">Saran Pemulihan:</p>
                    <p className="text-sm text-red-700 dark:text-red-400">
                      1. Cek file untuk memastikan format benar{'\n'}
                      2. Refresh halaman dan upload ulang{'\n'}
                      3. Jika masalah berlanjut, hubungi administrator
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Failed count */}
            <div className="px-4 py-3 bg-red-100/50 dark:bg-red-900/10 border-t border-red-200 dark:border-red-800">
              <p className="text-sm font-bold text-red-600 dark:text-red-400">
                {stats?.invalid_rows?.toLocaleString() || importData.failed_rows?.toLocaleString() || 0} baris tidak valid
              </p>
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
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-sm truncate">
                      <button
                        onClick={() => openDescriptionModal(dup.description || '-', index + 1, dup.transaction_date || '')}
                        className="flex items-center gap-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors w-full"
                      >
                        <span className="truncate flex-1 text-left">
                          {dup.description || '-'}
                        </span>
                        {(dup.description || '').length > 50 && (
                          <Maximize2 className="w-4 h-4 shrink-0 opacity-50" />
                        )}
                      </button>
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

      {/* Analysis Preview with Tabs */}
      {(() => {
        if (!previewRows || previewRows.length === 0) return null
        
        return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Pratinjau Data
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Menampilkan {filteredPreviewRows.length.toLocaleString()} dari {importData.total_rows?.toLocaleString() || 0} data
                </p>
              </div>
            </div>
            
            {/* Tab Navigation */}
            <div className="flex gap-2 overflow-x-auto scrollbar-thin">
              <button
                onClick={() => setActivePreviewTab('all')}
                className={`
                  px-4 py-2 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap
                  ${activePreviewTab === 'all' 
                    ? 'bg-linear-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25' 
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }
                `}
              >
                <Eye className="w-4 h-4" />
                Semua
                <span className={`
                  text-xs px-2 py-0.5 rounded-full font-bold
                  ${activePreviewTab === 'all' 
                    ? 'bg-white/20 text-white' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }
                `}>
                  {previewRows.length}
                </span>
              </button>
              
              <button
                onClick={() => setActivePreviewTab('valid')}
                className={`
                  px-4 py-2 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap
                  ${activePreviewTab === 'valid' 
                    ? 'bg-linear-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25' 
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }
                `}
              >
                <CheckCircle2 className="w-4 h-4" />
                Valid
                <span className={`
                  text-xs px-2 py-0.5 rounded-full font-bold
                  ${activePreviewTab === 'valid' 
                    ? 'bg-white/20 text-white' 
                    : 'bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300'
                  }
                `}>
                  {validCount}
                </span>
              </button>
              
              {duplicateCount > 0 && (
                <button
                  onClick={() => setActivePreviewTab('duplicate')}
                  className={`
                    px-4 py-2 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap
                    ${activePreviewTab === 'duplicate' 
                      ? 'bg-linear-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25' 
                      : 'text-amber-600 hover:text-amber-700 dark:text-amber-500 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/10'
                    }
                  `}
                >
                  <AlertTriangle className="w-4 h-4" />
                  Duplikat
                  <span className={`
                    text-xs px-2 py-0.5 rounded-full font-bold
                    ${activePreviewTab === 'duplicate' 
                      ? 'bg-white/20 text-white' 
                      : 'bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300'
                    }
                  `}>
                    {duplicateCount}
                  </span>
                </button>
              )}
              
              {invalidCount > 0 && (
                <button
                  onClick={() => setActivePreviewTab('invalid')}
                  className={`
                    px-4 py-2 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap
                    ${activePreviewTab === 'invalid' 
                      ? 'bg-linear-to-r from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-500/25' 
                      : 'text-rose-600 hover:text-rose-700 dark:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/10'
                    }
                  `}
                >
                  <XCircle className="w-4 h-4" />
                  Invalid
                  <span className={`
                    text-xs px-2 py-0.5 rounded-full font-bold
                    ${activePreviewTab === 'invalid' 
                      ? 'bg-white/20 text-white' 
                      : 'bg-rose-100 dark:bg-rose-800 text-rose-700 dark:text-rose-300'
                    }
                  `}>
                    {invalidCount}
                  </span>
                </button>
              )}
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
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredPreviewRows.map((row, index) => {
                  const isDuplicate = duplicateRowNumbers.has(row.row_number)
                  const status = !row.is_valid ? 'INVALID' : isDuplicate ? 'DUPLICATE' : 'VALID'
                  
                  return (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {row.row_number}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {row.transaction_date
                          ? format(new Date(row.transaction_date), 'dd/MM/yyyy', { locale: idLocale })
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-sm truncate">
                        <button
                          onClick={() => openDescriptionModal(row.description || '-', row.row_number, row.transaction_date)}
                          className="flex items-center gap-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors w-full"
                        >
                          <span className="truncate flex-1 text-left">
                            {row.description || '-'}
                          </span>
                          {(row.description || '').length > 50 && (
                            <Maximize2 className="w-4 h-4 shrink-0 opacity-50" />
                          )}
                        </button>
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
                      <td className="px-4 py-3 text-center">
                        <span className={`
                          inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold
                          ${status === 'VALID' 
                            ? 'bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300' 
                            : status === 'DUPLICATE'
                              ? 'bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300'
                              : 'bg-rose-100 dark:bg-rose-800 text-rose-700 dark:text-rose-300'
                          }
                        `}>
                          {status === 'VALID' && <CheckCircle2 className="w-3 h-3" />}
                          {status === 'DUPLICATE' && <AlertTriangle className="w-3 h-3" />}
                          {status === 'INVALID' && <XCircle className="w-3 h-3" />}
                          {status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )})()}

      {/* Description Detail Modal */}
      {showDescriptionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                  Detail Keterangan
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Baris {selectedRowInfo?.rowNumber || '-'} • {selectedRowInfo?.date 
                    ? format(new Date(selectedRowInfo.date), 'dd/MM/yyyy', { locale: idLocale })
                    : '-'}
                </p>
              </div>
              <button
                onClick={closeDescriptionModal}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <p className="text-gray-900 dark:text-white whitespace-pre-wrap wrap-break-word">
                  {selectedDescription}
                </p>
              </div>
              
              {/* Additional Info */}
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                  {selectedDescription.length} karakter
                </span>
                <span className="text-gray-400">•</span>
                <span>
                  {selectedDescription.split(/\s+/).length} kata
                </span>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end shrink-0">
              <button
                onClick={closeDescriptionModal}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function BankStatementImportDetailPage() {
  return <BankStatementImportDetailPageContent />
}

export default BankStatementImportDetailPage
