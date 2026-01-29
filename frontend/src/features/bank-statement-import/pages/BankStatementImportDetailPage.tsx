import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  AlertCircle,
  Download,
  FileText,
  Calendar,
  Hash,
  CheckCircle,
  Clock,
  XCircle,
  Loader2
} from 'lucide-react'
import { bankStatementImportApi } from '../api/bank-statement-import.api'
import type {
  BankStatementImport,
  BankStatementAnalysisResult
} from '../types/bank-statement-import.types'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

// Helper function untuk format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

// Helper function untuk format file size
function formatFileSize(bytes: number): string {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; icon: typeof CheckCircle; label: string }> = {
    PENDING: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock, label: 'Menunggu' },
    ANALYZED: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: FileText, label: 'Siap Import' },
    IMPORTING: { color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', icon: Loader2, label: 'Sedang Import' },
    COMPLETED: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle, label: 'Selesai' },
    FAILED: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle, label: 'Gagal' },
  }

  const { color, icon: Icon, label } = config[status] || config.PENDING

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  )
}

function BankStatementImportDetailPageContent() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [importData, setImportData] = useState<BankStatementImport | null>(null)
  const [analysisResult, setAnalysisResult] = useState<BankStatementAnalysisResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const abortControllerRef = useRef<AbortController | undefined>(undefined)

  // Fetch data
  useEffect(() => {
    if (!id) {
      navigate('/bank-statement-import')
      return
    }

    const fetchData = async () => {
      abortControllerRef.current?.abort()
      abortControllerRef.current = new AbortController()

      try {
        setLoading(true)
        setError(null)

        const [importRes, summaryRes] = await Promise.all([
          bankStatementImportApi.getById(id, abortControllerRef.current.signal),
          bankStatementImportApi.getSummary(id, abortControllerRef.current.signal)
        ])

        setImportData(importRes)
        setAnalysisResult(summaryRes)
      } catch (err) {
        if (err instanceof Error && err.name !== 'CanceledError') {
          setError(err.message || 'Gagal memuat data')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    return () => {
      abortControllerRef.current?.abort()
    }
  }, [id, navigate])

  // Export handler
  const handleExport = async () => {
    if (!id || !importData) return
    setExporting(true)
    try {
      const blob = await bankStatementImportApi.export(id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${importData.file_name.replace(/\.[^/.]+$/, '')}_export_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch {
      setError('Gagal mengekspor data')
    } finally {
      setExporting(false)
    }
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
          onClick={() => navigate('/bank-statement-import')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Import
        </button>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          <Download size={16} />
          {exporting ? 'Mengunduh...' : 'Export ke Excel'}
        </button>
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
          <StatusBadge status={importData.status} />
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
      {analysisResult?.analysis?.preview && analysisResult.analysis.preview.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Pratinjau Data
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              5 baris pertama dari file yang diupload.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {Object.keys(analysisResult.analysis.preview[0] as Record<string, unknown>).map((key) => (
                    <th
                      key={key}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                    >
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {(analysisResult.analysis.preview as Record<string, unknown>[]).slice(0, 5).map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    {Object.values(row).map((value: unknown, colIndex) => (
                      <td key={colIndex} className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {String(value ?? '-')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
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

