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
import type { BankStatementAnalysisResult } from '../types/bank-statement-import.types'

interface AnalysisModalProps {
  result: BankStatementAnalysisResult | null
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

  const { import: imp, analysis, duplicates } = result

  // Backend sends 'analysis' object, not 'stats'
  const total_rows = analysis?.total_rows || 0
  const valid_rows = analysis?.valid_rows || 0
  const invalid_rows = analysis?.invalid_rows || 0
  // Pending rows are the ones that are not valid and not invalid (PEND transactions)
  const pendingCount = total_rows - valid_rows - invalid_rows
  const duplicateCount = duplicates?.length || 0
  const warnings = analysis?.warnings || []

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
                {formatFileSize(imp.file_size || 0)}
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
        {warnings && Array.isArray(warnings) && warnings.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Peringatan</p>
                <ul className="text-xs text-amber-700 dark:text-amber-400 mt-1 space-y-1">
                  {warnings.map((warning: string, idx: number) => (
                    <li key={idx}>• {warning}</li>
                  ))}
                </ul>
              </div>
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

