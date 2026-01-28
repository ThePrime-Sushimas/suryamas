import { useState } from 'react'
import { 
  FileSpreadsheet, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Loader2,
  Upload,
  FileCheck,
  Clock,
  AlertCircle
} from 'lucide-react'

interface PreviewRow {
  row_number: number
  transaction_date: string
  description: string
  debit_amount: number
  credit_amount: number
  is_pending?: boolean
  errors?: string[]
  warnings?: string[]
}

interface DuplicateRow {
  transaction_date: string
  description: string
  debit: number
  credit: number
  balance: number
}

interface AnalysisResult {
  import: {
    id: number
    file_name: string
    file_size: number
    date_range_start?: string
    date_range_end?: string
    status: string
    total_rows: number
  }
  analysis: {
    total_rows: number
    valid_rows: number
    invalid_rows: number
    date_range_start: string
    date_range_end: string
    preview: PreviewRow[]
    duplicates: DuplicateRow[]
    errors: any[]
    warnings: string[]
  }
}

interface AnalysisModalProps {
  result: AnalysisResult | null
  onConfirm: (skipDuplicates: boolean) => Promise<void>
  onCancel: () => void
  isLoading: boolean
}

export function AnalysisModal({
  result,
  onConfirm,
  onCancel,
  isLoading,
}: AnalysisModalProps) {
  const [skipDuplicates, setSkipDuplicates] = useState(false)

  if (!result) return null

  const { import: imp, analysis } = result
  const { total_rows, valid_rows, invalid_rows, duplicates, warnings } = analysis

  // Hitung stats
  const pendingCount = result.analysis.preview?.filter((r) => r.is_pending).length || 0
  const duplicateCount = duplicates?.length || 0

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Format tanggal
  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-3xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <FileSpreadsheet className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Konfirmasi Import</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Review data sebelum mengimport ke sistem
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="btn btn-sm btn-ghost btn-circle"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* File Info Card */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[300px]">
                {imp.file_name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {formatFileSize(imp.file_size)} • {formatDate(imp.date_range_start)} - {formatDate(imp.date_range_end)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {total_rows.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Baris</p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {/* Valid Rows */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="text-xs font-medium text-green-700 dark:text-green-400">Valid</span>
            </div>
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">
              {valid_rows.toLocaleString()}
            </p>
          </div>

          {/* Pending Rows */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              <span className="text-xs font-medium text-yellow-700 dark:text-yellow-400">Pending</span>
            </div>
            <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
              {pendingCount.toLocaleString()}
            </p>
          </div>

          {/* Duplicates */}
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              <span className="text-xs font-medium text-orange-700 dark:text-orange-400">Duplikat</span>
            </div>
            <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">
              {duplicateCount.toLocaleString()}
            </p>
          </div>

          {/* Invalid Rows */}
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <span className="text-xs font-medium text-red-700 dark:text-red-400">Invalid</span>
            </div>
            <p className="text-2xl font-bold text-red-700 dark:text-red-400">
              {invalid_rows.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Warnings */}
        {warnings && warnings.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Peringatan</p>
                <ul className="text-xs text-amber-700 dark:text-amber-400 mt-1 space-y-1">
                  {warnings.map((warning, idx) => (
                    <li key={idx}>• {warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Preview Table - Simplified */}
        {result.analysis.preview && result.analysis.preview.length > 0 && (
          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Preview (5 data pertama)</p>
            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
              <table className="table table-xs">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="bg-gray-50 dark:bg-gray-800">Tanggal</th>
                    <th className="bg-gray-50 dark:bg-gray-800">Deskripsi</th>
                    <th className="text-right bg-gray-50 dark:bg-gray-800">Debit</th>
                    <th className="text-right bg-gray-50 dark:bg-gray-800">Kredit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {result.analysis.preview.slice(0, 5).map((row: PreviewRow, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="text-sm">
                        <span className={row.is_pending ? 'text-yellow-600 font-medium' : ''}>
                          {row.transaction_date}
                          {row.is_pending && <span className="ml-1 text-xs">(PEND)</span>}
                        </span>
                      </td>
                      <td className="text-sm max-w-[200px] truncate">{row.description}</td>
                      <td className="text-sm text-right font-mono">
                        {row.debit_amount > 0 ? row.debit_amount.toLocaleString('id-ID') : '-'}
                      </td>
                      <td className="text-sm text-right font-mono">
                        {row.credit_amount > 0 ? row.credit_amount.toLocaleString('id-ID') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Options */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={skipDuplicates}
              onChange={(e) => setSkipDuplicates(e.target.checked)}
              disabled={isLoading || duplicateCount === 0}
              className="checkbox checkbox-sm checkbox-primary"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Lewati duplikat saat import
            </span>
            {duplicateCount > 0 && (
              <span className="text-xs text-orange-600 dark:text-orange-400">
                ({duplicateCount} baris akan dilewati)
              </span>
            )}
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={isLoading}
          >
            Batal
          </button>
          <button
            type="button"
            className="btn btn-outline btn-primary"
            disabled={isLoading}
            onClick={() => onConfirm(true)}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Memproses...
              </>
            ) : (
              <>
                <FileCheck className="w-4 h-4" />
                Import & Skip Duplikat
              </>
            )}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={isLoading}
            onClick={() => onConfirm(false)}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Memproses...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Import Semua
              </>
            )}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onCancel} />
    </div>
  )
}

