import { useState } from 'react'
import { 
  AlertTriangle, 
  XCircle,
  Loader2,
  Upload,
  FileCheck,
  Eye,
  FileText,
  FileBarChart
} from 'lucide-react'
import type { BankStatementAnalysisResult } from '../types/bank-statement-import.types'
import { AnalysisSummary } from './analysis-modal/AnalysisSummary'
import { AnalysisPreview } from './analysis-modal/AnalysisPreview'
import { AnalysisWarnings } from './analysis-modal/AnalysisWarnings'

type TabType = 'summary' | 'preview' | 'warnings'

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
  const [activeTab, setActiveTab] = useState<TabType>('summary')
  const [skipDuplicates, setSkipDuplicates] = useState(false)

  if (!result) return null

  const { import: imp, analysis, warnings } = result

  // Backend sends 'analysis' object
  const total_rows = analysis?.total_rows || 0
  const valid_rows = analysis?.valid_rows || 0
  const invalid_rows = analysis?.invalid_rows || 0
  const duplicates = analysis?.duplicates || []
  const preview = analysis?.preview || []
  
  // Pending rows are the ones that are not valid and not invalid (PEND transactions)
  const pendingCount = total_rows - valid_rows - invalid_rows
  const duplicateCount = duplicates.length

  // Calculate percentages
  const validPercentage = total_rows > 0 ? Math.round((valid_rows / total_rows) * 100) : 0

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (!bytes) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="modal modal-open backdrop-blur-sm bg-black/30">
      <div className="modal-box max-w-5xl bg-white dark:bg-gray-900 rounded-3xl p-0 shadow-2xl overflow-hidden">
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md z-50 flex items-center justify-center">
            <div className="text-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-blue-100 dark:border-blue-900/50 animate-pulse"></div>
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="font-semibold text-lg text-gray-900 dark:text-gray-100 mt-4">Memproses import...</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {valid_rows.toLocaleString()} dari {total_rows.toLocaleString()} baris diproses
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-2xl">
                <FileBarChart className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-xl text-gray-900 dark:text-white">Konfirmasi Import</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Review data sebelum mengimport ke sistem
                </p>
              </div>
            </div>
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="btn btn-circle btn-ghost btn-sm hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <XCircle className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          
          {/* File Info Card & Progress */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1 flex items-center gap-3 min-w-0">
               <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white truncate">
                  {imp.file_name}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{formatFileSize(imp.file_size || 0)}</span>
                  <span>•</span>
                  <span>{total_rows.toLocaleString()} baris</span>
                </div>
              </div>
            </div>

            <div className="flex-1 w-full md:max-w-md">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-gray-500 font-medium">Kualitas Data</span>
                <span className="font-bold text-gray-900 dark:text-white">{validPercentage}% Valid</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden flex">
                <div className="bg-emerald-500 h-full" style={{ width: `${validPercentage}%` }} title="Valid" />
                <div className="bg-amber-400 h-full" style={{ width: `${(pendingCount / total_rows) * 100}%` }} title="Pending" />
                <div className="bg-rose-500 h-full" style={{ width: `${(invalid_rows / total_rows) * 100}%` }} title="Invalid" />
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6">
          {/* Tab Navigation */}
          <div className="flex gap-2 border-b border-gray-100 dark:border-gray-800 pb-1 mb-6 overflow-x-auto">
            <button
              className={`
                px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 whitespace-nowrap
                ${activeTab === 'summary' 
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' 
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }
              `}
              onClick={() => setActiveTab('summary')}
            >
              <FileBarChart className="w-4 h-4" />
              Ringkasan
            </button>
            <button
              className={`
                px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 whitespace-nowrap
                ${activeTab === 'preview' 
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' 
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }
              `}
              onClick={() => setActiveTab('preview')}
            >
              <Eye className="w-4 h-4" />
              Preview Data
            </button>
            {(duplicateCount > 0 || (warnings && warnings.length > 0)) && (
              <button
                className={`
                  px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 whitespace-nowrap
                  ${activeTab === 'warnings' 
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' 
                    : 'text-amber-600 hover:text-amber-700 dark:text-amber-500 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/10'
                  }
                `}
                onClick={() => setActiveTab('warnings')}
              >
                <AlertTriangle className="w-4 h-4" />
                Peringatan
                <span className="bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-xs px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                  {duplicateCount + (warnings?.length || 0)}
                </span>
              </button>
            )}
          </div>

          {/* Tab Content */}
          <div className="min-h-[300px]">
            {activeTab === 'summary' && <AnalysisSummary result={result} />}
            {activeTab === 'preview' && <AnalysisPreview previewData={preview} validRows={valid_rows} />}
            {activeTab === 'warnings' && <AnalysisWarnings warnings={warnings} duplicateCount={duplicateCount} />}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50/80 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-800 p-6 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <label className="flex items-center gap-3 cursor-pointer group select-none">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  disabled={isLoading || duplicateCount === 0}
                  className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-gray-300 bg-white checked:border-blue-600 checked:bg-blue-600 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800"
                />
                <svg
                  className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100"
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M10 3L4.5 8.5L2 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className={`text-sm font-medium ${duplicateCount === 0 ? 'text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                  Lewati Data Duplikat
                </span>
                {duplicateCount > 0 && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    {duplicateCount} baris akan dilewati
                  </span>
                )}
              </div>
            </label>

            <div className="flex gap-3 w-full sm:w-auto">
              <button
                type="button"
                className="btn btn-ghost hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl flex-1 sm:flex-none"
                onClick={onCancel}
                disabled={isLoading}
              >
                Batal
              </button>
              
              {skipDuplicates ? (
                <button
                  type="button"
                  className="btn btn-primary rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 flex-1 sm:flex-none gap-2"
                  disabled={isLoading}
                  onClick={() => onConfirm(true)}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileCheck className="w-4 h-4" />
                  )}
                  {isLoading ? 'Memproses...' : 'Import & Lewati Duplikat'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 flex-1 sm:flex-none gap-2"
                  disabled={isLoading}
                  onClick={() => onConfirm(false)}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {isLoading ? 'Memproses...' : 'Import Semua Data'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop bg-black/30 backdrop-blur-sm" onClick={onCancel} />
    </div>
  )
}

